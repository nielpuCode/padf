# padf

Personal PDF toolbox that runs **100% in your browser**. Files never leave your device — merge, split, compress, protect and annotate confidential PDFs without uploading them anywhere.

Works from any phone or computer with a modern browser; it is offline-capable once loaded.

## Tools

**Tier 0 — core**

| Tool | Notes |
|---|---|
| Merge | Multiple PDFs in order, optional per-file page range |
| Split | every N pages / by ranges / selected pages / approximate size |
| Compress (flatten) | Lossy: renders pages as JPEG images. Real size reduction |
| Recompress (basic) | Lossless re-save, small gains only |
| Password protect | AES-256, user + owner password, permissions |
| Remove password | You must own the document; needs the password |

**Tier 1**

| Tool | Notes |
|---|---|
| Extract / delete pages | Page ranges like `1-3,5,10` |
| Reorder pages | Explicit order, or `-` to reverse all |
| Rotate pages | Per range |
| Crop / resize pages | Numeric margins in points; resize to A4/Letter/A5/A3 |
| Insert another PDF | At any position |
| N-up | 2 / 4 / 6 pages per sheet |
| Booklet | Saddle-stitch imposition for duplex printing |
| Images to PDF | JPG and PNG only (no HEIC) |
| PDF to images | PNG or JPEG at chosen DPI, zipped output |
| Page numbers / header / footer | `{page}` `{total}` tokens |
| Watermark | Text, opacity, angle, optional tiling |

## Privacy

Everything is computed locally with WebAssembly/JavaScript:

- No uploads, no server code, no database, no analytics.
- Strict CSP in `index.html` (`connect-src 'none'`) makes new network connections impossible at runtime.
- Prove it yourself: open DevTools → Network, run a tool, see no request containing your file. The tab works with airplane mode on.

## Development

```sh
bun install
bun run dev      # local dev server
bun test         # unit tests (page ops, crypto, imaging)
bun run build    # typecheck + production build to dist/
```

## Deploy

Already wired for Vercel static hosting: push this folder to your GitHub repo, import the repo in Vercel. `vercel.json` sets `bun run build` and serves `dist/`. No functions, no storage — everything is static.

## Known limits

- Compress has no native image pipeline, so flatten conversion is the only strong option; text becomes pixels. Upgrade path: a Ghostscript worker would preserve text.
- Split by size is approximate.
- Booklet assumes duplex, short-edge flip.
- Encrypted input PDFs need their password for most tools; a wrong password gives a clear error.
