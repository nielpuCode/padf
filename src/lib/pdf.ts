import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfBytes } from './zip'
import { sanitizeFilename, stripExtension } from './zip'

export type { PDFDocument }

export interface LoadedFile {
  name: string
  shortName: string
  bytes: PdfBytes
}

export function shortNameBytes(name: string): string {
  return stripExtension(sanitizeFilename(name))
}

export async function openPdf(
  bytes: PdfBytes,
  password?: string,
): Promise<PDFDocument> {
  if (password !== undefined) {
    const doc = await PDFDocument.load(bytes, { password })
    // Encrypted sources must not carry /Encrypt into edited output; copy() strips it
    return doc.isEncrypted ? await doc.copy() : doc
  }
  try {
    return await PDFDocument.load(bytes)
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    if (/encrypt|password/i.test(msg)) {
      // Detect so the caller UI can prompt; load with password instead.
      throw new Error('This PDF is password protected. Enter the password and try again.')
    }
    throw new Error(`Cannot read PDF: ${msg}`)
  }
}

export async function isEncryptedPdf(bytes: PdfBytes): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    return doc.isEncrypted
  } catch {
    return false
  }
}

export async function savePdf(doc: PDFDocument): Promise<PdfBytes> {
  return doc.save({ useObjectStreams: true })
}

export function pdfPageCount(bytes: PdfBytes): Promise<number> {
  return PDFDocument.load(bytes, { ignoreEncryption: true }).then((d) => d.getPageCount())
}
