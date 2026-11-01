import { useState } from 'react'
import { savePdf, isEncryptedPdf } from '../lib/pdf'
import { stripExtension } from '../lib/zip'
import { mergePdfs, splitPdf, type SplitMode } from '../lib/ops/pages'
import { encryptPdf, decryptPdf } from '../lib/ops/crypto'
import { flattenCompress } from '../lib/ops/raster'
import {
  useResult, useOutputName, finalName, Files, Labeled, RunButton, ErrorBox, ResultBox, OutputNameField, type LoadedFile,
} from '../components/ui'

// ---------- Merge ----------

export function MergeScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [ranges, setRanges] = useState<string>('')
  const [outName, setOutName] = useOutputName()
  const { result, error, busy, run } = useResult()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const rangeList = ranges.trim() ? ranges.split(',').map((s) => s.trim()) : files.map(() => undefined)
    if (rangeList.length !== files.length) {
      return run(async () => { throw new Error('Give one optional range per file in order, or leave blank for all pages') })
    }
    run(async () => {
      const doc = await mergePdfs(files.map((f, i) => ({ bytes: f.bytes, rangeSpec: rangeList[i] || undefined })))
      return [{ name: finalName(outName, 'merged.pdf'), data: await savePdf(doc) }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <Files files={files} onChange={setFiles} accept=".pdf" />
      <Labeled label="Optional page ranges, comma separated, matching each file (e.g. 1-3, ,5-)">
        <input type="text" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, ,5-" />
      </Labeled>
      {files.length > 0 && <OutputNameField value={outName} onChange={setOutName} />}
      <RunButton busy={busy}>Merge</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- Split ----------

export function SplitScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [mode, setMode] = useState<SplitMode>('every')
  const [param, setParam] = useState('1')
  const [outName, setOutName] = useOutputName()
  const { result, error, busy, run } = useResult()

  const selected = files[fileIdx]
  const zipName = finalName(outName, `${selected ? stripExtension(selected.name) : 'output'}-split.zip`, 'zip')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a file') })
    run(async () => {
      const parts = await splitPdf(selected.bytes, mode, param)
      const out = []
      for (const p of parts) {
        out.push({ name: finalName(parts.length === 1 ? outName : '', `${stripExtension(selected.name)}-${p.name}.pdf`), data: await savePdf(p.doc) })
      }
      return out
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <Files files={files} onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} accept=".pdf" />
      {files.length > 0 && (
        <>
          <Labeled label="File to split">
            <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
              {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Mode">
            <select value={mode} onChange={(e) => { setMode(e.target.value as SplitMode); setParam(e.target.value === 'every' ? '2' : e.target.value === 'size' ? '50' : '1') }}>
              <option value="every">Every N pages</option>
              <option value="size">By approximate size (MB)</option>
              <option value="range">Ranges (e.g. 1-4,5-8)</option>
              <option value="selected">Selected pages (one output)</option>
            </select>
          </Labeled>
          <Labeled label={mode === 'size' ? 'Max MB' : 'Value'}>
            <input type="text" required value={param} onChange={(e) => setParam(e.target.value)} />
          </Labeled>
          {mode === 'every' && <p className="hint">Output file names use page ranges.</p>}
          <OutputNameField value={outName} onChange={setOutName} label={mode === 'every' ? 'ZIP name for multi-part output' : 'Output file name'} />
        </>
      )}
      <RunButton busy={busy}>Split</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} zipName={zipName} />
    </form>
  )
}

// ---------- Compress (flatten) ----------

export function CompressScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [preset, setPreset] = useState<'small' | 'balanced' | 'high'>('balanced')
  const [outName, setOutName] = useOutputName()
  const { result, error, busy, run } = useResult()
  const presets = { small: { dpi: 72, quality: 0.6 }, balanced: { dpi: 120, quality: 0.75 }, high: { dpi: 150, quality: 0.85 } }
  const selected = files[fileIdx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a file') })
    run(async () => {
      const data = await flattenCompress(selected.bytes, { ...presets[preset], onProgress: undefined })
      return [{ name: finalName(outName, `${stripExtension(selected.name)}-compressed.pdf`), data }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <p className="hint">Re-renders every page as an image: real size reduction, but text is no longer selectable.</p>
      <Files files={files} onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} accept=".pdf" />
      {files.length > 0 && (
        <>
          <Labeled label="File">
            <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
              {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Quality">
            <select value={preset} onChange={(e) => setPreset(e.target.value as 'small' | 'balanced' | 'high')}>
              <option value="small">Small (72 dpi)</option>
              <option value="balanced">Balanced (120 dpi)</option>
              <option value="high">High quality (150 dpi)</option>
            </select>
          </Labeled>
          <OutputNameField value={outName} onChange={setOutName} />
        </>
      )}
      <RunButton busy={busy}>Compress</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- Password add ----------

export function PasswordScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [userPw, setUserPw] = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  const [printing, setPrinting] = useState(true)
  const [copying, setCopying] = useState(true)
  const [modifying, setModifying] = useState(true)
  const [outName, setOutName] = useOutputName()
  const { result, error, busy, run } = useResult()
  const selected = files[fileIdx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a file') })
    const user = userPw
    const owner = ownerPw || userPw
    run(async () => {
      let srcPassword: string | undefined
      if (await isEncryptedPdf(selected.bytes)) {
        const entered = window.prompt('This PDF is already password protected. Enter the password so it can be replaced:')
        if (entered === null) throw new Error('Password required to re-protect')
        srcPassword = entered
      }
      if (!user || user.length < 1) throw new Error('Password required')
      const data = await encryptPdf(selected.bytes, { userPassword: user, ownerPassword: owner, printing, copying, modifying }, srcPassword)
      return [{ name: finalName(outName, `${stripExtension(selected.name)}-protected.pdf`), data }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <Files files={files} onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} accept=".pdf" />
      {files.length > 0 && (
        <>
          <Labeled label="File">
            <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
              {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="User password (to open)">
            <input type="password" value={userPw} onChange={(e) => setUserPw(e.target.value)} required />
          </Labeled>
          <Labeled label="Owner password (permissions; optional, defaults to user password)">
            <input type="password" value={ownerPw} onChange={(e) => setOwnerPw(e.target.value)} />
          </Labeled>
          <fieldset>
            <legend>Allowed</legend>
            <label><input type="checkbox" checked={printing} onChange={(e) => setPrinting(e.target.checked)} /> Print</label>
            <label><input type="checkbox" checked={copying} onChange={(e) => setCopying(e.target.checked)} /> Copy text</label>
            <label><input type="checkbox" checked={modifying} onChange={(e) => setModifying(e.target.checked)} /> Modify</label>
          </fieldset>
          <OutputNameField value={outName} onChange={setOutName} />
        </>
      )}
      <RunButton busy={busy}>Protect</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}

// ---------- Password remove ----------

export function UnlockScreen() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [fileIdx, setFileIdx] = useState(0)
  const [password, setPassword] = useState('')
  const [outName, setOutName] = useOutputName()
  const { result, error, busy, run } = useResult()
  const selected = files[fileIdx]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return run(async () => { throw new Error('Choose a file') })
    run(async () => {
      const encrypted = await isEncryptedPdf(selected.bytes)
      if (!encrypted) throw new Error('This PDF is not password protected')
      const data = await decryptPdf(selected.bytes, password)
      return [{ name: finalName(outName, `${stripExtension(selected.name)}-unlocked.pdf`), data }]
    })
  }
  return (
    <form onSubmit={submit} className="tool">
      <p className="hint">Files you use here never leave your device. Only remove passwords from documents you own.</p>
      <Files files={files} onChange={(f) => { setFiles(f); if (fileIdx >= f.length) setFileIdx(Math.max(0, f.length - 1)) }} accept=".pdf" />
      {files.length > 0 && (
        <>
          <Labeled label="File">
            <select value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
              {files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Labeled>
          <OutputNameField value={outName} onChange={setOutName} />
        </>
      )}
      <RunButton busy={busy}>Remove password</RunButton>
      <ErrorBox error={error} />
      <ResultBox result={result} />
    </form>
  )
}
