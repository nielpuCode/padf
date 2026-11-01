# padf

Personal PDF toolbox that runs **100% in your browser**. Files never leave your device. Merge, split, compress, protect and annotate confidential PDFs without uploading them anywhere.

Works from any phone or computer with a modern browser. It is offline-capable once loaded.

## Tools

**Tier 0 (core)**

| Tool | Notes |
|---|---|
| Merge | Multiple PDFs in order, optional per-file page range |
| Split | Every N pages / by ranges / selected pages / approximate size |
| Compress (flatten) | Lossy. Renders pages as JPEG images. Real size reduction |
| Recompress (basic) | Lossless re-save, small gains only |
| Password protect | AES-256, user + owner password, permissions |
| Remove password | You must own the document, it needs the password |

**Tier 1**

| Tool | Notes |
|---|---|
| Extract / delete pages | Page ranges like `1-3,5,10` |
| Reorder pages | Explicit order, or `-` to reverse all |
| Rotate pages | Per range |
| Crop / resize pages | Numeric margins in points. Resize to A4/Letter/A5/A3 |
| Insert another PDF | At any position |
| N-up | 2 / 4 / 6 pages per sheet |
| Booklet | Saddle-stitch imposition for duplex printing |
| Images to PDF | JPG and PNG only (no HEIC) |
| PDF to images | PNG or JPEG at chosen DPI, zipped output |
| Page numbers / header / footer | `{page}` `{total}` tokens |
| Watermark | Text, opacity, angle, optional tiling |

## Privacy

Everything is computed locally with WebAssembly and JavaScript.

- No uploads, no server code, no database, no analytics.
- Strict CSP in `index.html` (`connect-src 'none'`) makes new network connections impossible at runtime.
- Prove it yourself. Open DevTools, watch the Network tab while running a tool and see no request containing your file. The tab works with airplane mode on.

## Development

```sh
bun install
bun run dev      # local dev server
bun test         # unit tests (page ops, crypto, imaging)
bun run build    # typecheck + production build to dist/
```

## Deploy

Already wired for Vercel static hosting. Push this folder to your GitHub repo, then import the repo in Vercel. `vercel.json` sets `bun run build` and serves `dist/`. No functions, no storage, everything is static.

## Notes

- Every tool can name its own output file. Leave the field empty for the auto name. Multi-file results (split, PDF to images) arrive as a ZIP, and its name is yours to set too.

## Known limits

- Compress has no native image pipeline, so flatten conversion is the only strong option and text becomes pixels. Upgrade path would be a Ghostscript worker to preserve text.
- Split by size is approximate.
- Booklet assumes duplex, short-edge flip.
- Encrypted input PDFs need their password for most tools. A wrong password gives a clear error.
