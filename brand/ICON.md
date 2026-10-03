# World Weather app icon

A smiling golden sun with soft glowing rays peeks from behind a fluffy
white-to-sky-blue cloud; three light-blue raindrops fall from the cloud
and a small rainbow arc (red, gold, green, blue) emerges from a tiny
puff on the left. Flat modern style with subtle gradients and soft
shadows on a diagonal light-blue sky gradient (#9ADFFF to #3E9BE8).
No text.

- `icon.svg` is the vector source (512x512 viewBox).
- `icon.png` is the rendered 512x512 PNG the platform serves as the
  app's tile icon (declared in `dapp.json`).
- `public/favicon.svg` and `public/favicon.png` are browser-facing
  copies wired as the favicon (`index.html` + the `/favicon.ico`
  route in `server.js`). Re-copy them from here after any redraw.

To redraw: edit `icon.svg`, then rasterize to a 512x512 PNG (for
example `rsvg-convert -w 512 -h 512 icon.svg -o icon.png`).
