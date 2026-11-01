import { describe, test, expect } from 'bun:test'
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib'
import { parseRange, inverseRange } from '../src/lib/range'
import { sanitizeFilename, stripExtension, zipFiles } from '../src/lib/zip'
import { mergePdfs, extractPages, deletePages, reorderPages, rotatePages, splitPdf, insertInto } from '../src/lib/ops/pages'
import { cropPages, resizePages, nUp, booklet, addPageNumbers, addHeaderFooter, addTextWatermark, imagesToPdf, detectImageMime } from '../src/lib/ops/layout'
import { encryptPdf, decryptPdf } from '../src/lib/ops/crypto'

// fixture doc with known dims and count
async function makeDoc(pages: number, w = 600, h = 800, withText = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  if (withText) {
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (let i = 0; i < pages; i++) {
      const p = doc.addPage([w, h])
      p.drawText(`page ${i + 1}`, { x: 40, y: 40, size: 20, font })
    }
  } else {
    for (let i = 0; i < pages; i++) doc.addPage([w, h])
  }
  return doc.save()
}

const asDoc = (b: Uint8Array) => PDFDocument.load(b)

describe('range parser', () => {
  test('basic forms', () => {
    expect(parseRange('2', 10)).toEqual([2])
    expect(parseRange('1-3,5', 10)).toEqual([1, 2, 3, 5])
    expect(parseRange('4-2', 10)).toEqual([2, 3, 4])
    expect(parseRange('7-', 10)).toEqual([7, 8, 9, 10])
    expect(parseRange('-3', 10)).toEqual([1, 2, 3])
    expect(parseRange('10', 10)).toEqual([10])
  })
  test('rejects out-of-range', () => {
    expect(() => parseRange('11', 10)).toThrow()
    expect(() => parseRange('0', 10)).toThrow()
    expect(() => parseRange('', 10)).toThrow()
    expect(() => parseRange('abc', 10)).toThrow()
  })
  test('inverse', () => {
    expect(inverseRange([1, 2, 3], 5)).toEqual([4, 5])
  })
})

describe('zip lib helpers', () => {
  test('sanitize / strip / zip', () => {
    expect(sanitizeFilename('../../we"rd hello.pdf')).toBe('we_rd hello.pdf')
    expect(stripExtension('a.pdf')).toBe('a')
    const z = zipFiles([{ name: 'a.pdf', data: new Uint8Array([1]) }])
    expect(Buffer.from(z.slice(0, 2)).toString('latin1')).toBe('PK')
  })
})

describe('pages ops', () => {
  test('merge keeps order and count', async () => {
    const a = await makeDoc(3); const b = await makeDoc(2)
    const merged = await mergePdfs([{ bytes: a }, { bytes: b }])
    expect(merged.getPageCount()).toBe(5)
  })
  test('merge with per-file range', async () => {
    const a = await makeDoc(4)
    const merged = await mergePdfs([{ bytes: a, rangeSpec: '2-3' }])
    expect(merged.getPageCount()).toBe(2)
  })
  test('extract and delete', async () => {
    const a = await makeDoc(6)
    const ex = await extractPages(a, '2,4')
    expect(ex.getPageCount()).toBe(2)
    const del = await deletePages(a, '2,4')
    expect(del.getPageCount()).toBe(4)
  })
  test('delete all fails', async () => {
    const a = await makeDoc(1)
    await expect(deletePages(a, '1')).rejects.toThrow()
  })
  test('reorder full permutation only', async () => {
    const a = await makeDoc(3)
    const doc = await reorderPages(a, [3, 1, 2])
    expect(doc.getPageCount()).toBe(3)
    await expect(reorderPages(a, [1, 2])).rejects.toThrow()
    await expect(reorderPages(a, [2, 2, 1])).rejects.toThrow()
  })
  test('rotate accumulation', async () => {
    const a = await makeDoc(3)
    let d = await asDoc(a)
    d = await rotatePages(await d.save(), '1-2', 90)
    expect(d.getPage(0).getRotation().angle).toBe(90)
    d = await rotatePages(await d.save(), '1', 90)
    expect(d.getPage(0).getRotation().angle).toBe(180)
    expect(d.getPage(2).getRotation().angle).toBe(0)
  })
  test('split every N', async () => {
    const a = await makeDoc(7)
    const parts = await splitPdf(a, 'every', '3')
    expect(parts.length).toBe(3)
    expect((await asDoc(await parts[0].doc.save())).getPageCount()).toBe(3)
    expect((await asDoc(await parts[2].doc.save())).getPageCount()).toBe(1)
  })
  test('split by ranges produces single doc', async () => {
    const a = await makeDoc(8)
    const parts = await splitPdf(a, 'range', '1-4,5-8')
    expect(parts.length).toBe(1)
    expect((await parts[0].doc.save()).byteLength).toBeGreaterThan(100)
  })
  test('insert into position', async () => {
    const a = await makeDoc(3); const b = await makeDoc(2)
    const out = await insertInto(a, b, 2)
    expect(out.getPageCount()).toBe(5)
    const w = out.getPage(1).getSize().width
    expect(w).toBe(600)
  })
})

describe('layout ops', () => {
  test('crop shrinks boxes', async () => {
    const a = await makeDoc(2)
    const doc = await cropPages(a, undefined, { top: 10, right: 20, bottom: 30, left: 40 })
    const page = doc.getPage(0)
    expect(page.getSize().width).toBe(540)
    expect(page.getSize().height).toBe(760)
    await expect(cropPages(a, undefined, { top: 1000, right: 0, bottom: 0, left: 0 })).rejects.toThrow()
  })
  test('resize scales to A4 and centers', async () => {
    const a = await makeDoc(1, 1600, 1600)
    const doc = await resizePages(a, undefined, 595.28, 841.89)
    const size = doc.getPage(0).getSize()
    expect(size.width).toBe(595.28)
    expect(size.height).toBe(841.89)
  })
  test('n-up sheet math', async () => {
    const a = await makeDoc(7, 600, 800)
    const out = await nUp(a, 2)
    expect(out.getPageCount()).toBe(4)
  })
  test('booklet order and padding', async () => {
    const a = await makeDoc(5)
    const out = await booklet(a, true)
    // 5 pages -> padded to 8 -> 4 sheets of 2
    expect(out.getPageCount()).toBe(4)
    await expect(booklet(a, false)).rejects.toThrow()
    const b = await makeDoc(4)
    const strict = await booklet(b, false)
    expect(strict.getPageCount()).toBe(2)
  })
  test('page numbers draw and renumber', async () => {
    const a = await makeDoc(3, 600, 800, true)
    const doc = await addPageNumbers(a, { start: 5, format: '{page}/{total}', font: 10, margin: 20, position: 'bottom', align: 'center' })
    expect(doc.getPageCount()).toBe(3)
    // no crash + save round trip
    expect((await doc.save()).byteLength).toBeGreaterThan(0)
  })
  test('header/footer tokens', async () => {
    const a = await makeDoc(2, 600, 800, true)
    const doc = await addHeaderFooter(a, { headerLeft: 'L{page}', footerCenter: 'F{total}', font: 9, margin: 20 })
    expect((await doc.save()).byteLength).toBeGreaterThan(0)
  })
  test('watermark center and tile', async () => {
    const a = await makeDoc(2, 600, 800, true)
    const doc = await addTextWatermark(a, { text: 'CONFIDENTIAL', fontSize: 24, opacity: 0.5, angle: 45, tile: false })
    expect((await doc.save()).byteLength).toBeGreaterThan(0)
    const tiled = await addTextWatermark(a, { text: 'CONFIDENTIAL', fontSize: 0.2, opacity: 0.3, angle: 45, tile: true, fontSizeIsFraction: true })
    expect((await tiled.save()).byteLength).toBeGreaterThan(0)
  })
})

describe('crypto ops', () => {
  test('encrypt then decrypt roundtrip', async () => {
    const a = await makeDoc(2, 600, 800, true)
    const enc = await encryptPdf(a, { userPassword: 'user', ownerPassword: 'owner', printing: true, copying: false, modifying: false })
    // encrypted: loads only with password
    expect((await PDFDocument.load(enc, { password: 'user' })).getPageCount()).toBe(2)
    await expect(PDFDocument.load(enc)).rejects.toThrow(/encrypt/i)
    // decrypt to clean bytes
    const dec = await decryptPdf(enc, 'user')
    const plain = await PDFDocument.load(dec)
    expect(plain.isEncrypted).toBe(false)
    expect(plain.getPageCount()).toBe(2)
  })
})

// 1x1 PNG and JPEG fixtures
const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const jpeg1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDA1NDQ0Hyc5PTn/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgA//9k=',
  'base64',
)

describe('images to pdf', () => {
  test('detect mime', () => {
    expect(detectImageMime(png1x1)).toBe('image/png')
    expect(detectImageMime(jpeg1x1)).toBe('image/jpeg')
    expect(detectImageMime(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  test('build pdf from PNG(s), a4 mode', async () => {
    const doc = await imagesToPdf([{ name: 'p.png', bytes: new Uint8Array(png1x1) }, { name: 'p2.png', bytes: new Uint8Array(png1x1) }], { mode: 'a4' })
    expect(doc.getPageCount()).toBe(2)
    const size = doc.getPage(0).getSize()
    expect(size.width).toBe(595.28)
  })
  test('reject unsupported formats', async () => {
    await expect(imagesToPdf([{ name: 'x', bytes: new Uint8Array([1, 2, 3]) }])).rejects.toThrow()
  })
})

describe('fixture save roundtrip for every tool output', () => {
  test('all ops produce openable PDFs', async () => {
    const a = await makeDoc(4, 600, 800, true)
    const results: Uint8Array[] = [
      await save(await mergePdfs([{ bytes: a }])),
      await save((await splitPdf(a, 'every', '2'))[0].doc),
      await save(await extractPages(a, '1-2')),
      await save(await resizePages(a, undefined, 595.28, 841.89)),
      await save(await addPageNumbers(a, { start: 1, format: '{page}', font: 10, margin: 20, position: 'bottom', align: 'center' })),
      await save(await addHeaderFooter(a, { footerCenter: 'x{page}', font: 9, margin: 20 })),
      await save(await addTextWatermark(a, { text: 'W', fontSize: 12, opacity: 0.1, angle: 45, tile: false })),
      await save(await nUp(a, 4)),
      await save(await booklet(await asDoc(a).then((d) => d.save()), true)),
      await save(await insertInto(a, a, 1)),
    ]
    for (const d of results) {
      const doc = await asDoc(d)
      expect(doc.getPageCount()).toBeGreaterThan(0)
    }
  })
})

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save()
}
