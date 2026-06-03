This folder holds site logo assets used by the app and social sharing.

Files:
- `logo.svg` — primary scalable logo (512×512 viewBox). Edit to change colors/text.

Generate PNG fallbacks (ImageMagick / Inkscape examples):

ImageMagick (convert):

```bash
# 512x512 PNG for social cards
convert logo.svg -background none -resize 512x512 logo-512.png

# 192x192 PNG for favicon / manifest
convert logo.svg -background none -resize 192x192 logo-192x192.png
```

Inkscape / rsvg-convert:

```bash
rsvg-convert -w 512 -h 512 logo.svg -o logo-512.png
rsvg-convert -w 192 -h 192 logo.svg -o logo-192x192.png
```

Notes:
- Place generated `logo-og.png` (1200×630) for Open Graph large images if desired.
- Ensure filenames match references in `frontend/src/app/layout.tsx`.
