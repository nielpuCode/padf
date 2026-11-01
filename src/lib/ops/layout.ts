import { PDFDocument, degrees, StandardFonts, rgb } from '@cantoo/pdf-lib'
import type { PdfBytes } from '../zip'
import { parseRange } from '../range'
import { openPdf } from '../pdf'

// ---------- images -> PDF ----------

export function detectImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

export interface ImagePageOptions {
  mode: 'image' | 'a4' // page = image dims, or letterboxed onto A4 portrait
}

export async function imagesToPdf(
  images: { name: string; bytes: Uint8Array }[],
  opts: ImagePageOptions = { mode: 'image' },
): Promise<PDFDocument> {
  if (!images.length) throw new Error('No images selected')
  const doc = await PDFDocument.create()
  for (const img of images) {
    const mime = detectImageMime(img.bytes)
    if (!mime) throw new Error(`${img.name}: unsupported format. Convert to JPG or PNG first.`)
    const embedded =
      mime === 'image/png'
        ? await doc.embedPng(img.bytes)
        : await doc.embedJpg(img.bytes)
    if (opts.mode === 'a4') {
      const page = doc.addPage([595.28, 841.89])
      const s = Math.min(595.28 / embedded.width, 841.89 / embedded.height)
      const w = embedded.width * s
      const h = embedded.height * s
      page.drawImage(embedded, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h })
    } else {
      const page = doc.addPage([embedded.width, embedded.height])
      page.drawImage(embedded, { x: 0, y: 0 })
    }
  }
  return doc
}

// ---------- page geometry ----------

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export async function cropPages(
  bytes: PdfBytes,
  rangeSpec: string | undefined,
  m: Margins,
  password?: string,
): Promise<PDFDocument> {
  const doc = await openPdf(bytes, password)
  const total = doc.getPageCount()
  const selected = new Set(parseRange(rangeSpec || `1-${total}`, total))
  for (let i = 1; i <= total; i++) {
    if (!selected.has(i)) continue
    const page = doc.getPage(i - 1)
    const { width, height } = page.getSize()
    const newW = width - m.left - m.right
    const newH = height - m.top - m.bottom
    if (newW <= 0 || newH <= 0) {
      throw new Error(`Margins remove too much on page ${i}`)
    }
    // Content coordinates are unchanged; we shrink all visible boxes in place.
    page.setMediaBox(m.left, m.bottom, newW, newH)
    page.setCropBox(m.left, m.bottom, newW, newH)
  }
  return doc
}

// Resize pages to a target box, scaling content to fit and centering.
export async function resizePages(
  bytes: PdfBytes,
  rangeSpec: string | undefined,
  targetW: number,
  targetH: number,
  password?: string,
): Promise<PDFDocument> {
  if (targetW <= 0 || targetH <= 0) throw new Error('Target size must be positive')
  const doc = await openPdf(bytes, password)
  const total = doc.getPageCount()
  const selected = new Set(parseRange(rangeSpec || `1-${total}`, total))
  for (let i = 1; i <= total; i++) {
    if (!selected.has(i)) continue
    const page = doc.getPage(i - 1)
    const { width, height } = page.getSize()
    const s = Math.min(targetW / width, targetH / height)
    const paddedW = width * s
    const paddedH = height * s
    page.scaleContent(s, s)
    page.setSize(targetW, targetH)
    page.translateContent((targetW - paddedW) / 2, (targetH - paddedH) / 2)
  }
  return doc
}

// ---------- N-up / booklet ----------

function gridFor(per: 2 | 4 | 6): { cols: number; rows: number } {
  if (per === 2) return { cols: 2, rows: 1 }
  if (per === 4) return { cols: 2, rows: 2 }
  return { cols: 3, rows: 2 }
}

// ponytail: images are accepted as JPG or PNG bytes from the browser; canvas conversion if needed.

export async function nUp(
  bytes: PdfBytes,
  per: 2 | 4 | 6,
  sheetW?: number,
  sheetH?: number,
  password?: string,
): Promise<PDFDocument> {
  const doc = await openPdf(bytes, password)
  const srcPages = doc.getPages()
  if (!srcPages.length) throw new Error('PDF has no pages')
  const { cols, rows } = gridFor(per)
  const maxAspect = Math.max(...srcPages.map((p) => p.getSize().width / p.getSize().height))
  const sheetWidth = sheetW ?? Math.max(...srcPages.map((p) => p.getSize().width))
  const cellH = sheetH ?? (sheetWidth ? sheetWidth / (cols * maxAspect) : 0)
  const out = await PDFDocument.create()

  for (let start = 0; start < srcPages.length; start += per) {
    const group = srcPages.slice(start, start + per)
    const sheet = out.addPage([sheetWidth, cellH * rows])
    const cw = sheetWidth / cols
    const ch = cellH
    for (let k = 0; k < group.length; k++) {
      const embedded = await out.embedPage(group[k])
      const { width, height } = group[k].getSize()
      const s = Math.min(cw / width, ch / height)
      const w = width * s
      const h = height * s
      const col = k % cols
      const row = Math.floor(k / cols)
      sheet.drawPage(embedded, {
        x: col * cw + (cw - w) / 2,
        y: cellH * rows - (row + 1) * ch + (ch - h) / 2,
        width: w,
        height: h,
      })
    }
  }
  return out
}

// Saddle-stitch imposition: pages grouped two per sheet in print order.
export async function booklet(
  bytes: PdfBytes,
  padBlank: boolean,
  password?: string,
): Promise<PDFDocument> {
  const doc = await openPdf(bytes, password)
  const srcPages = doc.getPages()
  let n = srcPages.length
  if (!padBlank && n % 4 !== 0) {
    throw new Error(`Page count must be a multiple of 4 for booklet (got ${n}); choose padding instead`)
  }
  while (n % 4 !== 0) n += 1
  const get = (i: number) => srcPages[i] // zero-based, empties beyond length stay blank

  const empty = srcPages[0]
  const out = await PDFDocument.create()
  const first = empty.getSize()
  for (let s = 0; s < n / 4; s++) {
    const pairs = [
      [n - 2 * s - 1, 2 * s],       // front sheet: back-most page, first page
      [2 * s + 1, n - 2 * s - 2],   // back sheet
    ]
    for (const [leftIdx, rightIdx] of pairs) {
      const left = leftIdx < srcPages.length ? get(leftIdx) : undefined
      const right = rightIdx < srcPages.length ? get(rightIdx) : undefined
      const size = (left ?? right)?.getSize() ?? first
      const sheet = out.addPage([size.width * 2, size.height])
      const draw = async (page: typeof srcPages[number] | undefined, atX: number) => {
        if (!page) return
        const embedded = await out.embedPage(page)
        const { width, height } = page.getSize()
        sheet.drawPage(embedded, { x: atX, y: 0, width, height })
      }
      await draw(left, 0)
      await draw(right, size.width)
    }
  }
  return out
}

// ---------- annotations ----------

export interface NumberOptions {
  start: number
  format: string // tokens: {page} {total}
  font: number
  margin: number
  position: 'top' | 'bottom'
  align: 'left' | 'center' | 'right'
}

export async function addPageNumbers(
  bytes: PdfBytes,
  opts: NumberOptions,
  password?: string,
): Promise<PDFDocument> {
  if (opts.start < 0) throw new Error('Start number must be 0 or higher')
  if (opts.font <= 0 || opts.font > 144) throw new Error('Font size must be 1..144')
  const doc = await openPdf(bytes, password)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const total = pages.length
  pages.forEach((page, i) => {
    const text = opts.format.replace(/\{page\}/g, String(opts.start + i)).replace(/\{total\}/g, String(total))
    const { width: pw, height: ph } = page.getSize()
    const tw = font.widthOfTextAtSize(text, opts.font)
    const x = opts.align === 'center' ? (pw - tw) / 2 : opts.align === 'right' ? pw - tw - opts.margin : opts.margin
    const y = opts.position === 'bottom' ? opts.margin : ph - opts.margin - opts.font
    if (x < 0 || y < 0) throw new Error(`Margin or font too large for page ${i + 1}`)
    page.drawText(text, { x, y, size: opts.font, font, color: rgb(0, 0, 0) })
  })
  return doc
}

export interface HeaderFooterOptions {
  headerLeft?: string
  headerCenter?: string
  headerRight?: string
  footerLeft?: string
  footerCenter?: string
  footerRight?: string
  font: number
  margin: number
}

export async function addHeaderFooter(
  bytes: PdfBytes,
  opts: HeaderFooterOptions,
  password?: string,
): Promise<PDFDocument> {
  const doc = await openPdf(bytes, password)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  pages.forEach((page, i) => {
    const { width: pw, height: ph } = page.getSize()
    const filled = opts as unknown as Record<string, string | undefined>
    for (const slot of ['headerLeft', 'headerCenter', 'headerRight', 'footerLeft', 'footerCenter', 'footerRight']) {
      let text = filled[slot]
      if (!text) continue
      text = text.replace(/\{page\}/g, String(i + 1)).replace(/\{total\}/g, String(pages.length))
      const tw = font.widthOfTextAtSize(text, opts.font)
      const [where, align] = slot.toLowerCase().split(/(?=center|left|right)/) as [string, string]
      const isHeader = where.startsWith('header')
      const x = align === 'center' ? (pw - tw) / 2 : align === 'right' ? pw - tw - opts.margin : opts.margin
      const y = isHeader ? ph - opts.margin - opts.font : opts.margin
      page.drawText(text, { x, y, size: opts.font, font, color: rgb(0, 0, 0) })
    }
  })
  return doc
}

export interface WatermarkOptions {
  text: string
  fontSize: number
  opacity: number
  angle: number
  tile: boolean
  fontSizeIsFraction?: boolean
}

export async function addTextWatermark(
  bytes: PdfBytes,
  opts: WatermarkOptions,
  password?: string,
): Promise<PDFDocument> {
  if (!opts.text.trim()) throw new Error('Watermark text is required')
  if (opts.opacity <= 0 || opts.opacity > 1) throw new Error('Opacity must be between 0 and 1')
  const doc = await openPdf(bytes, password)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = opts.fontSizeIsFraction ? opts.fontSize * width : opts.fontSize
    const tw = font.widthOfTextAtSize(opts.text, size)
    const th = size
    const color = rgb(0.5, 0.5, 0.5)
    if (opts.tile) {
      // Diagonal grid of marks covering the page
      const stepX = Math.max(tw, size) * 1.6
      const stepY = size * 3
      const count = Math.ceil((width + height) / Math.min(stepX, stepY)) * 2
      if (count > 5000) throw new Error('Watermark tile too dense; raise font size')
      for (let y = -height; y < width + height; y += stepY) {
        for (let x = 0; x < width + height; x += stepX) {
          page.drawText(opts.text, {
            x, y, size, font, color,
            rotate: degrees(opts.angle),
            opacity: opts.opacity,
          })
        }
      }
    } else {
      page.drawText(opts.text, {
        x: width / 2 - tw / 2,
        y: height / 2 - th / 2,
        size, font, color,
        rotate: degrees(opts.angle),
        opacity: opts.opacity,
      })
    }
  }
  return doc
}
