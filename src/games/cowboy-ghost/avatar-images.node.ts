import { loadImage } from "@napi-rs/canvas";
import type { FighterKind } from "./entity.js";
import { AVATAR_IMAGE_CONFIG, setAvatarImage } from "./avatar-images.js";

export async function preloadNodeAvatarImages(): Promise<void> {
  for (const [kind, config] of Object.entries(AVATAR_IMAGE_CONFIG) as Array<
    [FighterKind, (typeof AVATAR_IMAGE_CONFIG)[FighterKind]]
  >) {
    try {
      const image = await loadImage(config.filePath);
      setAvatarImage(kind, image as never);
    } catch {
      // Missing avatar files fall back to built-in badge rendering.
    }
  }
}
