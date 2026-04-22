# smallgame 实现方案

本文档梳理当前仓库的实现思路：一个可复现的小游戏自动对战视频生成器。核心目标是 **"同一个 seed → 同一段视频"**，并同时支持浏览器预览与 Node 端批量导出。

## 总体架构

```
┌────────────────────────┐      ┌───────────────────────┐
│  web/ (Vite 浏览器预览) │      │  src/cli.ts (单条导出) │
│  web/main.ts           │      │  src/batch.ts (批量)   │
└────────────┬───────────┘      └───────────┬───────────┘
             │ 共享同一套游戏逻辑             │
             ▼                               ▼
      ┌──────────────────────────────────────────┐
      │ src/games/registry.ts (GameDefinition)   │
      │   ├── tank (TankGame)                    │
      │   └── cowboy-ghost (CowboyGhostGame)     │
      └──────────────────┬───────────────────────┘
                         │
                         ▼
      ┌──────────────────────────────────────────┐
      │ src/engine/ (loop 常量 / rng / vec)       │
      └──────────────────────────────────────────┘
                         │
                         ▼ (Node 端渲染后)
      ┌──────────────────────────────────────────┐
      │ src/record/ffmpeg.ts                     │
      │ @napi-rs/canvas → PNG → ffmpeg stdin     │
      └──────────────────────────────────────────┘
```

## 核心不变量

这些常量定义在 `src/engine/loop.ts`，被预览端和导出端共享：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `FPS` | 60 | 固定帧率 |
| `DT` | 1/60 | 每帧步长（秒） |
| `ARENA_W` / `ARENA_H` | 720 / 1280 | 竖屏画布尺寸 |
| `DURATION_SECONDS` | 15 | 单局视频时长 |
| `TOTAL_TICKS` | 900 | 最多模拟帧数 |

因为步长 `DT` 固定、所有随机性都来自 seed 驱动的 RNG，所以同一个 seed 下物理和 AI 行为完全可复现。

## 确定性随机数：`src/engine/rng.ts`

`createRng(seed)` 基于 Mulberry32 风格的线性同余生成器：

- `next()` 返回 `[0, 1)` 均匀分布
- `range(min, max)` 浮点区间
- `int(min, max)` 整数区间（闭区间）
- `pick(arr)` 均匀抽取

所有游戏逻辑（初始抖动、AI 抉择、伤害掷骰、粒子方向）都走这一个 RNG 实例，避免混入 `Math.random()` 这种非确定性源。

## 游戏抽象：`GameInstance` / `GameDefinition`

`src/games/registry.ts` 定义了所有小游戏必须满足的契约：

```ts
interface GameInstance {
  readonly seed: number;
  tick: number;
  outcome: GameOutcome | null;
  step(): void;                               // 推进一帧
  render(ctx: CanvasRenderingContext2D): void;// 把当前状态画到 ctx
  isDone(): boolean;                          // 是否可以停止模拟
}

interface GameDefinition {
  id: string;
  title: string;
  create(seed: number): GameInstance;
  describePreview(game): string;              // 浏览器 HUD 信息
  describeResult(game): string;               // CLI 结束时日志
  outputFileName(seed: number): string;       // 默认输出文件名
}
```

`GAME_DEFINITIONS` 是一个只读数组，当前注册了：

- `tank` → `TankGame`，输出 `tank-battle-<seed>.mp4`
- `cowboy-ghost` → `CowboyGhostGame`，输出 `cowboy-ghost-<seed>.mp4`

新增一个小游戏 = 实现 `GameInstance` + 在 registry 里追加一条 `defineGame(...)` 条目。浏览器和 CLI 会自动识别新游戏。

## 主循环（预览 vs 导出）

两端写法一模一样：

- **浏览器**（`web/main.ts`）：`requestAnimationFrame` 里 `game.step() → game.render(ctx) → 更新 HUD`，直到 `isDone()`。
- **CLI**（`src/cli.ts`）：同步 while 循环 `game.step() → game.render(ctx) → recorder.writeFrame(canvas.toBuffer("image/png"))`。

两处共享同一份 `game.step() / game.render()`，所以预览看到的对局就是最终视频里的对局。

## 视频录制管线：`src/record/ffmpeg.ts`

- 使用 `ffmpeg-static` 提供跨平台的 ffmpeg 二进制
- `spawn ffmpeg` 接收 `image2pipe`（PNG 帧流），编码为 H.264 MP4
- 参数要点：`-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart`
- `writeFrame(buf)` 把 Node `Canvas` 生成的 PNG buffer 直接写入 `proc.stdin`，避免落盘中间帧
- `finish()` 关闭 stdin 并等待 ffmpeg 退出

## Tank 小游戏（`src/games/tank/`）

2v2 红蓝坦克对战：

- `game.ts`：`TankGame` 持有 4 辆坦克、子弹、粒子、障碍物与 outcome
- `tank.ts`：坦克实体（`maxHp`、`shieldHp`、`stats` 等），含 push / support 角色位
- `ai.ts`：`decide(self, enemy, bullets, tick, rng)` 返回 `{ bodyAngleTarget, turretAngleTarget, throttle, fire }`
- `bullet.ts`：子弹生成与飞行
- `obstacle.ts` + `map.ts`：硬编码的 5 块障碍物与地图装饰
- `render.ts`：画背景、障碍、坦克、子弹、粒子、HUD、屏幕震动与闪白

时间线：前 `INTRO_TICKS = 48` 帧是入场、中段战斗、结束后再保留 `OUTRO_TICKS = FPS * 2` 帧做收尾。`isDone()` 在达到 `TOTAL_TICKS` 或分出胜负后再跑完 outro 时返回 true。胜负判定：任一方全灭；若到时间平局则比较剩余队伍总血量。

## Cowboy vs Ghost 小游戏（`src/games/cowboy-ghost/`）

1v1 贴身 + 远程格斗：

- `game.ts`：`CowboyGhostGame` 管两个 `Fighter`、伤害飘字、边界反弹
- `entity.ts`：`Fighter` 及其 stats（`accel` / `maxSpeed` / `friction` / `attackRange` / `cooldown`…）
- `render.ts`：绘制背景、两个角色、伤害数字 HUD

关键机制：

- Cowboy 倾向保持 `preferredRange`，侧移走位；Ghost 追身近战
- 攻击在冷却且进入 `attackRange` 时生效，`rng.int(attackMin, attackMax)` 掷伤害，同时施加击退
- 边界用 `bounce` 做轻微反弹，避免卡墙
- 单局 `ROUND_TICKS = FPS * 35`，outro 同样 `FPS * 2`

## CLI 命令

`package.json` 里声明了三个脚本：

```bash
npm run dev       # vite 启动浏览器预览
npm run generate  # tsx src/cli.ts  （单条）
npm run batch     # tsx src/batch.ts （批量）
```

- `generate -- --game <id> --seed <n> [--out <path>]`
- `batch -- --game <id> --from <a> --to <b> [--dir <path>]`

默认 `game` 取 `GAME_DEFINITIONS[0].id`（即 `tank`），默认输出目录 `output/`。

## 目录速查

```
src/
  engine/
    loop.ts     FPS / DT / ARENA_W / ARENA_H / TOTAL_TICKS
    rng.ts      createRng(seed)
    vec.ts      Vec 工具与 clamp / angleDiff
  games/
    registry.ts 游戏注册表与 GameDefinition / GameInstance 契约
    tank/       坦克 2v2
    cowboy-ghost/ 1v1 近身/远程
  record/
    ffmpeg.ts   PNG → ffmpeg → MP4 的录制管线
  cli.ts        单条导出入口
  batch.ts      批量导出入口
web/
  index.html / main.ts  Vite 预览页
output/         默认导出目录
```

## 新增一个小游戏的步骤

1. 在 `src/games/<id>/` 新建目录，编写 `game.ts` 并导出一个实现 `GameInstance` 的类
2. 为它写 `render.ts`，接收 `CanvasRenderingContext2D` 与游戏实例
3. 在 `src/games/registry.ts` 的 `GAME_DEFINITIONS` 追加一条 `defineGame({...})`
4. 浏览器下拉菜单和 `npm run generate -- --game <id>` 会自动识别

注意事项：

- 只使用 `this.rng` 产生随机，不要用 `Math.random()`，否则破坏可复现性
- 所有运动都乘 `DT`，不要假设真实 wall-clock 时间
- 渲染使用标准 `CanvasRenderingContext2D` API 子集（Node 端用的是 `@napi-rs/canvas`，避免过于冷门的浏览器专属 API）
- `isDone()` 要在合理的帧数内收敛，否则视频时长会超出设计的 15 秒窗口
