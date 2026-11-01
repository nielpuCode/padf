import { useState } from 'react'
import { savePdf } from '../lib/pdf'
import { stripExtension } from '../lib/zip'
import { insertInto } from '../lib/ops/pages'
import { nUp, booklet } from '../lib/ops/layout'
import { OneFileRangeScreen } from './geometry'
import {
  useResult, Files, Labeled, RunButton, ErrorBox, ResultBox, type LoadedFile,
} from '../components/ui'

// ---------- Insert PDF into another ----------

export function InsertScreen() {
  const [dst, setDst] = useState<LoadedFile[]>([])
  const [src, setSrc] = useState<LoadedFile[]>([])
  const [position, setPosition] = useState('1')
  const [srcSpec, setSrcSpec] = useState('')
  const { result, error, busy, run } = useResult()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const dstFile = dst[0]
    const srcFile = src[0]
    if (!dstFile || !srcFile) return run(async () => { throw new Error('Choose both a main PDF and a PDF to insert') })
    run(async () => {
      const doc = await insertInto(dstFile.bytes, srcFile.bytes, parseInt(position, 10) || 1, srcSpec.trim() || undefined)
      return [{ name: `${stripExtension(dstFile.name)}-combined.pdf`, data: await savePdf(doc) }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <h2>Insert another PDF</h2>
      <Labeled label="Main PDF"><Files files={dst} onChange={setDst} accept=".pdf" /></Labeled>
      <Labeled label="PDF to insert"><Files files={src} onChange={setSrc} accept=".pdf" /></Labeled>
      {dst.length > 0 && src.length > 0 && (
        <>
          <Labeled label="Insert before page (1 = start)"><input type="number" min="1" value={position} onChange={(e) => setPosition(e.target.value)} /></Labeled>
          <Labeled label="Pages to insert (empty = all)"><input type="text" value={srcSpec} onChange={(e) => setSrcSpec(e.target.value)} placeholder="1-3" /></Labeled>
        </>
      )}
      <RunButton busy={busy}>Insert</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- N-up ----------

export function NUpScreen() {
  const [per, setPer] = useState(2)
  return (
    <OneFileRangeScreen
      title="N-up pages per sheet"
      hint="Puts several pages onto one larger sheet, keeping aspect."
      form={(
        <Labeled label="Pages per sheet">
          <select value={per} onChange={(e) => setPer(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
          </select>
        </Labeled>
      )}
      run={(bytes) => nUp(bytes, per as 2 | 4 | 6).then((d) => savePdf(d).then((data) => ({ data, extra: `-${per}up` })))}
    />
  )
}

// ---------- Booklet ----------

export function BookletScreen() {
  const [pad, setPad] = useState(true)
  return (
    <OneFileRangeScreen
      title="Booklet imposition"
      hint="Reorders pages for saddle-stitch duplex printing: [last,1] then [2,last-1] pairs on landscape sheets. Set your printer to print on both sides, flip on short edge."
      form={(
        <Labeled label="If page count is not a multiple of 4">
          <select value={pad ? 'pad' : 'fail'} onChange={(e) => setPad(e.target.value === 'pad')}>
            <option value="pad">Add blank pages</option>
            <option value="fail">Show an error</option>
          </select>
        </Labeled>
      )}
      run={(bytes) => booklet(bytes, pad).then((d) => savePdf(d).then((data) => ({ data, extra: '-booklet' })))}
    />
  )
}
