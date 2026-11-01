import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfBytes } from '../zip'
import { openPdf } from '../pdf'

export interface EncryptOptions {
  userPassword: string
  ownerPassword?: string
  printing?: boolean | 'lowResolution' | 'highResolution'
  modifying?: boolean
  copying?: boolean
}

export async function encryptPdf(
  bytes: PdfBytes,
  opts: EncryptOptions,
  passwordOfSource?: string,
): Promise<PdfBytes> {
  if (!opts.userPassword && !opts.ownerPassword) throw new Error('Set at least one password')
  const doc = await openPdf(bytes, passwordOfSource)
  doc.encrypt({
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword || opts.userPassword,
    permissions: {
      printing: opts.printing ?? true,
      modifying: opts.modifying ?? true,
      copying: opts.copying ?? true,
    },
  })
  return doc.save()
}

export async function decryptPdf(bytes: PdfBytes, password: string): Promise<PdfBytes> {
  const doc = await openPdf(bytes, password)
  return (await doc.copy()).save()
}
