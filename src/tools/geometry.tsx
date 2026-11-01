import { useState } from 'react'
import { savePdf, pdfPageCount } from '../lib/pdf'
import { stripExtension } from '../lib/zip'
import { extractPages, deletePages, reorderPages, rotatePages } from '../lib/ops/pages'
import { cropPages, resizePages, type Margins } from '../lib/ops/layout'
import { useResult, Files, Labeled, RunButton, ErrorBox, ResultBox, OutputNameField, finalName, type LoadedFile } from '../components/ui'

// Shared single-file picker with page count readout.
function PickOne({ files, setFiles, fileIdx, setFileIdx, accept = '.pdf' }: {
  files: LoadedFile[]
  setFiles: (f: LoadedFile[]) => void
  fileIdx: number
  setFileIdx: (i: number) => void
  accept?: string
}) {
  return (
    <>
      <Files
        files={files}
        accept={accept}
        onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }}
      />
      {files.length > 0 && (
        <Labeled label="File">
          <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
            {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
          </select>
        </Labeled>
      )}
    </>
  )
}

async function runForFile(
  selected: LoadedFile | undefined,
  op: (bytes: Uint8Array) => Promise<{ data: Uint8Array; extra?: string }>,
): Promise<{ name: string; data: Uint8Array }[]> {
  if (!selected) throw new Error('Choose a file')
  const { data, extra } = await op(selected.bytes)
  const suffix = extra ?? ''
  return [{ name: `${stripExtension(selected.name)}${suffix}.pdf`, data }]
}

// ---------- generic wrapper for one-file-with-range tools ----------
export function OneFileRangeScreen(props: {
  title: string
  hint?: string
  accept?: string
  form: React.ReactNode
  run: (bytes: Uint8Array, password: string | undefined) => Promise<{ data: Uint8Array; extra?: string }>
}) {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [password, setPassword] = useState('')
  const [outName, setOutName] = useState('')
  const { result, error, busy, run } = useResult()
  const selected = files[fileIdx]
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const pw = password || undefined
    run(async () => {
      const out = await runForFile(selected, (bytes) => props.run(bytes, pw))
      return [{ ...out[0], name: finalName(outName, out[0].name) }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      {props.hint && <p className="hint">{props.hint}</p>}
      <PickOne files={files} setFiles={setFiles} fileIdx={fileIdx} setFileIdx={setFileIdx} accept={props.accept} />
      {files.length > 0 && (
        <>
          <Labeled label="Password (leave empty if not protected)">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Labeled>
          {props.form}
          <OutputNameField value={outName} onChange={setOutName} />
        </>
      )}
      <RunButton busy={busy}>Run</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

export function ExtractScreen() {
  const [spec, setSpec] = useState('')
  return (
    <OneFileRangeScreen
      title="Extract pages"
      form={<Labeled label="Pages to extract (e.g. 1-3,5,10)"><input type="text" required value={spec} onChange={(e) => setSpec(e.target.value)} /></Labeled>}
      run={(bytes, pw) => extractPages(bytes, spec, pw).then((d) => savePdf(d).then((data) => ({ data, extra: '-extracted' })))}
    />
  )
}

export function DeleteScreen() {
  const [spec, setSpec] = useState('')
  return (
    <OneFileRangeScreen
      title="Delete pages"
      form={<Labeled label="Pages to delete (e.g. 2,7-9)"><input type="text" required value={spec} onChange={(e) => setSpec(e.target.value)} /></Labeled>}
      run={(bytes, pw) => deletePages(bytes, spec, pw).then((d) => savePdf(d).then((data) => ({ data, extra: '-deleted' })))}
    />
  )
}

export function ReorderScreen() {
  const [order, setOrder] = useState('')
  return (
    <OneFileRangeScreen
      title="Reorder pages"
      hint="List every page number exactly once, comma separated (e.g. 4,1,2,3). Type - to reverse all pages."
      form={<Labeled label="New order"><input type="text" required value={order} onChange={(e) => setOrder(e.target.value)} /></Labeled>}
      run={async (bytes, pw) => {
        const total = await pdfPageCount(bytes)
        let parsed: number[]
        if (order.trim() === '-') {
          parsed = Array.from({ length: total }, (_, i) => total - i)
        } else {
          parsed = order.split(',').map((s) => parseInt(s.trim(), 10))
          if (parsed.some((n) => Number.isNaN(n))) throw new Error('Use page numbers like 4,1,2,3')
        }
        const doc = await reorderPages(bytes, parsed, pw)
        return { data: await savePdf(doc), extra: '-reordered' }
      }}
    />
  )
}

export function RotateScreen() {
  const [spec, setSpec] = useState('')
  const [delta, setDelta] = useState(90)
  return (
    <OneFileRangeScreen
      title="Rotate pages"
      hint="Leave range empty to rotate all pages."
      form={(
        <>
          <Labeled label="Pages (empty = all)"><input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3,7" /></Labeled>
          <Labeled label="Turn">
            <select value={delta} onChange={(e) => setDelta(Number(e.target.value))}>
              <option value={90}>90° clockwise</option>
              <option value={180}>180°</option>
              <option value={270}>90° counter-clockwise</option>
            </select>
          </Labeled>
        </>
      )}
      run={(bytes, pw) => rotatePages(bytes, spec || undefined, (delta as 90 | 180 | 270), pw).then((d) => savePdf(d).then((data) => ({ data, extra: '-rotated' })))}
    />
  )
}

export function CropScreen() {
  const [spec, setSpec] = useState('')
  const [m, setM] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  const num = (k: keyof Margins, label: string) => (
    <Labeled key={k} label={label}>
      <input type="number" min="0" value={m[k]} onChange={(e) => setM({ ...m, [k]: Number(e.target.value) })} />
    </Labeled>
  )
  return (
    <OneFileRangeScreen
      title="Crop pages"
      hint="Plain PDF coordinates in points (1 pt = 1/72 inch). A4 is 595x842 pt."
      form={(
        <>
          <Labeled label="Pages (empty = all)"><input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3,5" /></Labeled>
          {num('top', 'Top margin')}
          {num('right', 'Right margin')}
          {num('bottom', 'Bottom margin')}
          {num('left', 'Left margin')}
        </>
      )}
      run={(bytes, pw) => cropPages(bytes, spec || undefined, m, pw).then((d) => savePdf(d).then((data) => ({ data, extra: '-cropped' })))}
    />
  )
}

const paperSizes: Record<string, [number, number] | undefined> = {
  'A4': [595.28, 841.89],
  'Letter': [612, 792],
  'A5': [419.53, 595.28],
  'A3': [841.89, 1190.55],
}

export function ResizeScreen() {
  const [spec, setSpec] = useState('')
  const [size, setSize] = useState('A4')
  return (
    <OneFileRangeScreen
      title="Resize pages"
      hint="Scales content to fit the target paper size and centers it. Custom sizes need points."
      form={(
        <>
          <Labeled label="Pages (empty = all)"><input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-3,5" /></Labeled>
          <Labeled label="Target size">
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              {Object.keys(paperSizes).map((k) => <option key={k}>{k}</option>)}
            </select>
          </Labeled>
        </>
      )}
      run={(bytes, pw) => {
        const t = paperSizes[size]
        if (!t) throw new Error('Pick a size')
        return resizePages(bytes, spec || undefined, t[0], t[1], pw).then((d) => savePdf(d).then((data) => ({ data, extra: '-resized' })))
      }}
    />
  )
}
