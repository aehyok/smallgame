# Avatar PNGs

Put the configurable avatar PNG files here:

- `public/avatars/trump.png`
- `public/avatars/musk.png`

The game will automatically use these files in:

- Browser preview: `npm run dev`
- Video export: `npm run generate ...`
- Batch export: `npm run batch ...`

If a file is missing, the game falls back to the built-in drawn avatar.

Recommended image requirements:

- PNG format
- Square canvas, recommended `1024 x 1024`
- Subject centered
- Leave visible margin around the head so it does not touch the top edge
- Transparent background is preferred, but a full illustrated background also works
- Avoid extra outer borders, text, or watermarks
