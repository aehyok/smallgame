import type { FighterKind } from "./entity.js";

export type DrawableImage = Parameters<CanvasRenderingContext2D["drawImage"]>[0];

export const AVATAR_IMAGE_CONFIG: Record<
  FighterKind,
  { label: string; webPath: string; filePath: string }
> = {
  cowboy: {
    label: "Trump",
    webPath: "/avatars/trump.png",
    filePath: "public/avatars/trump.png",
  },
  ghost: {
    label: "Musk",
    webPath: "/avatars/musk.png",
    filePath: "public/avatars/musk.png",
  },
};

const avatarImages = new Map<FighterKind, DrawableImage>();

export function setAvatarImage(kind: FighterKind, image: DrawableImage): void {
  avatarImages.set(kind, image);
}

export function getAvatarImage(kind: FighterKind): DrawableImage | undefined {
  return avatarImages.get(kind);
}

export async function preloadBrowserAvatarImages(): Promise<void> {
  await Promise.all(
    (Object.entries(AVATAR_IMAGE_CONFIG) as Array<
      [FighterKind, (typeof AVATAR_IMAGE_CONFIG)[FighterKind]]
    >).map(async ([kind, config]) => {
      const image = await loadBrowserImage(config.webPath);
      if (image) setAvatarImage(kind, image);
    }),
  );
}

function loadBrowserImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
