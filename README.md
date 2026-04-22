# smallgame

AI vs AI 坦克对战视频生成器。

这个项目会根据给定的 `seed` 运行一局可复现的坦克对战，并输出一条竖屏 MP4 视频。它适合做“批量生成短视频素材”的小型内容流水线，也可以在浏览器里实时预览每个种子的战斗过程。

## 功能亮点

- 给定相同 `seed`，游戏过程和最终视频结果保持一致
- 单局固定输出 15 秒、`720 × 1280`、`60fps` 的 H.264 MP4
- 浏览器预览与 Node 端视频生成共用同一套 `TankGame` 逻辑
- 支持单条生成，也支持按种子区间批量出片
- 使用 `@napi-rs/canvas` 渲染 PNG 帧，再通过 `ffmpeg-static` 编码视频

## 环境要求

- Node.js 18+ 推荐
- npm

项目使用了 `ffmpeg-static`，通常不需要额外全局安装 `ffmpeg`。

## 快速开始

安装依赖：

```bash
npm install
```

启动浏览器预览：

```bash
npm run dev
```

默认会启动一个本地 Vite 开发服务。页面左上角可以：

- 输入 `seed`
- 重新开始当前对局
- 切换到下一个 `seed`

## 生成视频

生成单条视频：

```bash
npm run generate -- --seed 42
```

默认输出到：

```text
output/battle-42.mp4
```

自定义输出路径：

```bash
npm run generate -- --seed 42 --out output/custom-42.mp4
```

批量生成：

```bash
npm run batch -- --from 1 --to 10
```

默认会输出到 `output/` 目录，例如：

```text
output/battle-1.mp4
output/battle-2.mp4
...
output/battle-10.mp4
```

自定义批量输出目录：

```bash
npm run batch -- --from 11 --to 20 --dir output/set-b
```

## 命令一览

```bash
npm run dev
npm run generate -- --seed <number> [--out <path>]
npm run batch -- --from <start> --to <end> [--dir <path>]
```

## 项目设计

- 确定性模拟：同一个 `seed` 会驱动同一局战斗，便于复现、筛选和批量生产
- 固定时长：每局最多运行 `60fps × 15s = 900` 帧
- 统一逻辑：预览和导出使用同一份游戏逻辑，减少“预览正常、导出不一致”的问题
- 渲染管线：Node 端逐帧绘制后直接写入 `ffmpeg` stdin，避免中间帧文件落盘

## 目录结构

```text
src/
  engine/       通用基础：随机数、向量、主循环常量
  games/tank/   坦克游戏逻辑、AI、渲染
  record/       视频录制与 ffmpeg 管道封装
  cli.ts        单条视频生成入口
  batch.ts      批量生成入口
web/            浏览器预览页面（Vite）
output/         导出视频目录（默认不会提交到 Git）
```

## 适合做什么

- 批量生成短视频素材
- 对比不同 `seed` 的对战观感
- 验证“确定性模拟 + 视频导出”这类小游戏内容管线
- 作为更复杂 AI 对战视频系统的最小原型
