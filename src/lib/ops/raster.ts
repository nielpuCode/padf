import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfBytes } from '../zip'
import { openPdf } from '../pdf'
import { parseRange } from '../range'

// ---------- browser-only: raster helpers (pdfjs) ----------
// Loaded lazily so bun tests and non-raster tools never pull pdfjs.

export interface RasterStart {
  doc: import('pdfjs-dist').PDFDocumentProxy
}

export async function openForRaster(bytes: PdfBytes): Promise<RasterStart> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  // Copy: pdfjs may transfer the buffer to the worker.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
  return { doc }
}

export interface PdfToImageOptions {
  format: 'png' | 'jpeg'
  dpi: number
  rangeSpec?: string
  quality?: number
  onProgress?: (done: number, total: number) => void
}

export async function pdfToImages(
  bytes: PdfBytes,
  opts: PdfToImageOptions,
): Promise<{ name: string; data: Uint8Array }[]> {
  const { doc } = await openForRaster(bytes)
  const total = doc.numPages
  const indices = (opts.rangeSpec ? parseRange(opts.rangeSpec, total) : Array.from({ length: total }, (_, i) => i + 1))
  const out: { name: string; data: Uint8Array }[] = []
  for (let k = 0; k < indices.length; k++) {
    const page = await doc.getPage(indices[k])
    const scale = opts.dpi / 72
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
        opts.format === 'png' ? 'image/png' : 'image/jpeg',
        opts.format === 'jpeg' ? (opts.quality ?? 0.85) : undefined,
      ),
    )
    out.push({ name: `page-${String(indices[k]).padStart(4, '0')}.${opts.format === 'png' ? 'png' : 'jpg'}`, data: new Uint8Array(await blob.arrayBuffer()) })
    page.cleanup()
    opts.onProgress?.(k + 1, indices.length)
  }
  await doc.destroy()
  return out
}

// "Flatten" compression: render each page to JPEG at target DPI/q and rebuild.
// ponytail: text becomes pixels; upgrade path = a Ghostscript server worker if quality matters
export interface FlattenOptions {
  dpi: number
  quality: number // 0..1
  onProgress?: (done: number, total: number) => void
}

export async function flattenCompress(
  bytes: PdfBytes,
  opts: FlattenOptions,
): Promise<PdfBytes> {
  const { doc: pdfDoc } = await openForRaster(bytes)
  const out = await PDFDocument.create()
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: opts.dpi / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', opts.quality),
    )
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    // Page box in points = original points (jpeg is raster of the page)
    const base = page.getViewport({ scale: 1 })
    const newPage = out.addPage([base.width, base.height])
    newPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })
    page.cleanup()
    opts.onProgress?.(i, pdfDoc.numPages)
  }
  await pdfDoc.destroy()
  return out.save()
}
