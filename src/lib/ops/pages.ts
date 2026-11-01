import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import type { PdfBytes } from '../zip'
import { parseRange, inverseRange } from '../range'
import { savePdf, openPdf } from '../pdf'

// Merge multiple PDFs in order. Optional per-file page range.
export async function mergePdfs(
  files: { bytes: PdfBytes; rangeSpec?: string }[],
): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  for (const { bytes, rangeSpec } of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const indices = rangeSpec
      ? parseRange(rangeSpec, src.getPageCount()).map((n) => n - 1)
      : src.getPageIndices()
    const pages = await out.copyPages(src, indices)
    pages.forEach((p) => out.addPage(p))
  }
  return out
}

// Shared: load one doc and resolve a range spec against it.
export async function loadDoc(bytes: PdfBytes, password?: string): Promise<{ doc: PDFDocument; total: number }> {
  const doc = await openPdf(bytes, password)
  return { doc, total: doc.getPageCount() }
}

export async function extractPages(
  bytes: PdfBytes,
  rangeSpec: string,
  password?: string,
): Promise<PDFDocument> {
  const src = await loadDoc(bytes, password)
  const indices = parseRange(rangeSpec, src.total).map((n) => n - 1)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src.doc, indices)
  pages.forEach((p) => out.addPage(p))
  return out
}

export async function deletePages(
  bytes: PdfBytes,
  rangeSpec: string,
  password?: string,
): Promise<PDFDocument> {
  const { doc, total } = await loadDoc(bytes, password)
  const keep = inverseRange(parseRange(rangeSpec, total), total).map((n) => n - 1)
  if (keep.length === 0) throw new Error('Cannot delete every page')
  return rebuildSubset(doc, keep)
}

// Reorder: order is an explicit permutation of all pages (1-based).
export async function reorderPages(
  bytes: PdfBytes,
  order: number[],
  password?: string,
): Promise<PDFDocument> {
  const { doc } = await loadDoc(bytes, password)
  const valid = order.length === doc.getPageCount() &&
    order.every((n, i) => n >= 1 && typeof n === 'number')
  if (!valid || new Set(order).size !== order.length) {
    throw new Error('Order must list every page exactly once')
  }
  return rebuildSubset(doc, order.map((n) => n - 1))
}

async function rebuildSubset(
  doc: PDFDocument,
  zeroIndices: number[],
): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(doc, zeroIndices)
  pages.forEach((p) => out.addPage(p))
  return out
}

export async function rotatePages(
  bytes: PdfBytes,
  rangeSpec: string | undefined,
  delta: 90 | 180 | 270,
  password?: string,
): Promise<PDFDocument> {
  const { doc, total } = await loadDoc(bytes, password)
  const selected = new Set(parseRange(rangeSpec || `1-${total}`, total))
  for (let i = 1; i <= total; i++) {
    if (!selected.has(i)) continue
    const page = doc.getPage(i - 1)
    const current = page.getRotation().angle
    page.setRotation(degrees(((current + delta) % 360 + 360) % 360))
  }
  return doc
}

export type SplitMode = 'every' | 'range' | 'selected' | 'size'

// every: chunk of n pages. range: user picks segment spec; selected: one doc with selected pages.
export async function splitPdf(
  bytes: PdfBytes,
  mode: SplitMode,
  param: string,
  password?: string,
): Promise<{ name: string; doc: PDFDocument }[]> {
  const src = await loadDoc(bytes, password)
  if (mode === 'every') {
    const n = parseInt(param, 10)
    if (!Number.isInteger(n) || n < 1) throw new Error('Pages per file must be a whole number >= 1')
    const out: { name: string; doc: PDFDocument }[] = []
    const total = src.total
    for (let start = 1; start <= total; start += n) {
      const end = Math.min(start + n - 1, total)
      out.push({ name: `pages-${start}-${end}`, doc: await rebuildSubset(src.doc, range(start, end)) })
    }
    return out
  }
  if (mode === 'size') {
    // ponytail: approximate size split by re-saving per chunk; exact binary budget if it ever matters
    const maxSize = parseInt(param, 10) * 1024 * 1024
    if (!Number.isInteger(maxSize) || maxSize < 1024) throw new Error('Max size must be in megabytes')
    const out: { name: string; doc: PDFDocument }[] = []
    let chunk: number[] = []
    let chunkSize = 0
    for (let i = 0; i < src.total; i++) {
      const candidate = [...chunk, i]
      const test = await rebuildSubset(src.doc, candidate)
      const data = await test.save()
      if (data.byteLength > maxSize && chunk.length > 0) {
        out.push({ name: `part-${out.length + 1}`, doc: await rebuildSubset(src.doc, chunk) })
        chunk = [i]
        chunkSize = data.byteLength
      } else {
        chunk = candidate
        chunkSize = data.byteLength
      }
    }
    if (chunk.length) out.push({ name: `part-${out.length + 1}`, doc: await rebuildSubset(src.doc, chunk) })
    if (chunkSize > maxSize) throw new Error('A single page exceeds the size limit; cannot split')
    return out
  }
  // range / selected: single output doc of the parsed range
  const doc = await rebuildSubset(src.doc, parseRange(param, src.total).map((n) => n - 1))
  return [{ name: 'split', doc }]
}

function range(start: number, end: number): number[] {
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i - 1)
  return out
}

// Insert src pages into dst at position (1-based; 0 = before first page).
export async function insertInto(
  dstBytes: PdfBytes,
  srcBytes: PdfBytes,
  position: number,
  srcRangeSpec?: string,
  dstPassword?: string,
  srcPassword?: string,
): Promise<PDFDocument> {
  const dst = await loadDoc(dstBytes, dstPassword)
  const src = await loadDoc(srcBytes, srcPassword)
  const indices = srcRangeSpec
    ? parseRange(srcRangeSpec, src.total).map((n) => n - 1)
    : src.doc.getPageIndices()
  const copied = await dst.doc.copyPages(src.doc, indices)
  const at = Math.max(0, Math.min(position, dst.total)) | 0
  copied.forEach((p, i) => dst.doc.insertPage(at + i, p))
  return dst.doc
}

export async function finalize(doc: PDFDocument): Promise<PdfBytes> {
  return savePdf(doc)
}
