import { describe, test, expect } from 'bun:test'
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'

// Probe assumptions about @cantoo/pdf-lib API before building the rest.
describe('pdf-lib API probe', () => {
  test('create doc, pages, fonts', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (let i = 0; i < 5; i++) {
      const p = doc.addPage([600, 800])
      p.drawText(`page ${i + 1}`, { x: 50, y: 400, size: 24, font })
    }
    expect(doc.getPageCount()).toBe(5)
    const bytes = await doc.save()
    expect(bytes.byteLength).toBeGreaterThan(500)
  })

  test('copyPages across docs (merge/extract)', async () => {
    const a = await PDFDocument.create()
    for (let i = 0; i < 3; i++) a.addPage([700, 900])
    const b = await PDFDocument.create()
    const [p0] = await b.copyPages(a, [0])
    b.addPage(p0)
    expect(b.getPageCount()).toBe(1)
    const size = p0.getSize()
    expect(size.width).toBe(700)
  })

  test('embedPage from another doc for N-up', async () => {
    const src = await PDFDocument.create()
    for (let i = 0; i < 4; i++) src.addPage([200, 200])
    const out = await PDFDocument.create()
    for (const page of src.getPages()) {
      const embedded = await out.embedPage(page)
      const sheet = out.addPage([400, 400])
      sheet.drawPage(embedded, { x: 0, y: 0, width: 200, height: 200 })
    }
    expect(out.getPageCount()).toBe(4)
  })

  test('rotation, boxes, translate', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([600, 800])
    page.setRotation(degrees(90))
    expect(page.getRotation().angle).toBe(90)
    page.setMediaBox(10, 10, 500, 700)
    const { width, height } = page.getSize()
    expect(width).toBe(500)
    expect(height).toBe(700)
    page.scaleContent(0.5, 0.5)
    page.setSize(600, 800)
    page.translateContent(50, 50)
  })

  test('encrypt + decrypt roundtrip (needs crypto.getRandomValues)', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800])
    doc.encrypt({ userPassword: 'secret', ownerPassword: 'owner' })
    const enc = await doc.save()
    const text = Buffer.from(enc.slice(0, 8)).toString('latin1')
    expect(text.startsWith('%PDF')).toBe(true)
    // reopen with password
    const reopened = await PDFDocument.load(enc, { password: 'secret' })
    expect(reopened.getPageCount()).toBe(1)
    // wrong password must throw
    let failed = false
    try {
      await PDFDocument.load(enc, { password: 'wrong' })
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    // save() alone keeps /Encrypt; a copy() produces a clean unencrypted doc
    const plain = await (await reopened.copy()).save()
    const opened = await PDFDocument.load(plain)
    expect(opened.isEncrypted).toBe(false)
  })

  test('load encrypted without password throws or flags', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    doc.encrypt({ userPassword: 'pw' })
    const enc = await doc.save()
    const ignored = await PDFDocument.load(enc, { ignoreEncryption: true, updateMetadata: false })
    expect(ignored.isEncrypted).toBe(true)
  })
})
