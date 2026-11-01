import { useState } from 'react'
import { savePdf, openPdf } from '../lib/pdf'
import { stripExtension } from '../lib/zip'
import { imagesToPdf, detectImageMime } from '../lib/ops/layout'
import { pdfToImages } from '../lib/ops/raster'
import { useResult, Files, Labeled, RunButton, ErrorBox, ResultBox, type LoadedFile } from '../components/ui'

// ---------- Images -> PDF ----------

export function ImagesToPdfScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [mode, setMode] = useState<'image' | 'a4'>('image')
  const { result, error, busy, run } = useResult()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return run(async () => { throw new Error('Choose images') })
    run(async () => {
      const bad = files.find((f) => !detectImageMime(f.bytes))
      if (bad) throw new Error(`${bad.name}: only JPG and PNG supported. iPhone photos are HEIC; convert first.`)
      const doc = await imagesToPdf(files.map((f) => ({ name: f.name, bytes: f.bytes })), { mode })
      return [{ name: 'images.pdf', data: await savePdf(doc) }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <h2>Images to PDF</h2>
      <Files files={files} onChange={setFiles} accept="image/jpeg,image/png" />
      {files.length > 0 && (
        <Labeled label="Page size">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'image' | 'a4')}>
            <option value="image">Same as image</option>
            <option value="a4">A4 portrait (contain)</option>
          </select>
        </Labeled>
      )}
      <RunButton busy={busy}>Create PDF</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- PDF -> Images ----------

export function PdfToImagesScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [dpi, setDpi] = useState(150)
  const [spec, setSpec] = useState('')
  const { result, error, busy, run, setProgress } = useResult()
  const selected = files[fileIdx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a PDF') })
    if (dpi < 36 || dpi > 600) return run(async () => { throw new Error('DPI must be between 36 and 600') })
    run(async () => {
      await openPdf(selected.bytes) // friendly error if encrypted
      setProgress('0')
      const imgs = await pdfToImages(selected.bytes, {
        format,
        dpi,
        rangeSpec: spec.trim() || undefined,
        onProgress: (done, total) => setProgress(`${done}/${total}`),
      })
      setProgress(null)
      const base = stripExtension(selected.name)
      return imgs.map((im) => ({ name: `${base}-${im.name}`, data: im.data }))
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <h2>PDF to images</h2>
      <Files files={files} accept=".pdf" onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} />
      {files.length > 0 && (
        <>
          <Labeled label="File">
            <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
              {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Format">
            <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}>
              <option value="png">PNG (lossless)</option>
              <option value="jpeg">JPEG (smaller)</option>
            </select>
          </Labeled>
          <Labeled label="DPI"><input type="number" min="36" max="600" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} /></Labeled>
          <Labeled label="Pages (empty = all)"><input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3,7" /></Labeled>
        </>
      )}
      <RunButton busy={busy}>{busy ? 'Rendering…' : 'Convert'}</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- Basic compress (re-save) ----------

export function BasicCompressScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const { result, error, busy, run } = useResult()
  const selected = files[fileIdx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a file') })
    run(async () => {
      const doc = await openPdf(selected.bytes)
      const data = await doc.save()
      const suffix = data.byteLength < selected.bytes.byteLength ? '-recompressed' : '-unchanged'
      return [{ name: `${stripExtension(selected.name)}${suffix}.pdf`, data }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <h2>Recompress PDF (basic)</h2>
      <p className="hint">Rebuilds the file with object streams. Small gains only, no quality loss. For real reduction use Compress (flatten).</p>
      <Files files={files} accept=".pdf" onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} />
      {files.length > 0 && (
        <Labeled label="File">
          <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
            {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
          </select>
        </Labeled>
      )}
      <RunButton busy={busy}>Recompress</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}
