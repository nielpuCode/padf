import { zipSync } from 'fflate'

export type PdfBytes = Uint8Array

export function isPdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 5))
  return head.startsWith('%PDF')
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim()
  return cleaned || 'file'
}

export function stripExtension(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

export function downloadBlob(data: Uint8Array | Blob, filename: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(filename)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function zipFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const f of files) {
    let name = sanitizeFilename(f.name)
    let i = 1
    while (used.has(name)) name = name.replace(/(\.[^.]*)?$/, `-${i++}$1`)
    used.add(name)
    entries[name] = f.data
  }
  return zipSync(entries)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
