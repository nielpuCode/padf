import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { downloadBlob, zipFiles, formatBytes, sanitizeFilename } from '../lib/zip'

export type LoadedFile = { name: string; bytes: Uint8Array; size: number }

export async function fileToLoaded(file: File): Promise<LoadedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { name: sanitizeFilename(file.name), bytes, size: bytes.byteLength }
}

export function useResult() {
  const [result, setResult] = useState<{ name: string; data: Uint8Array }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const run = useCallback(
    async (task: () => Promise<{ name: string; data: Uint8Array }[]>) => {
      setError(null)
      setResult(null)
      setBusy(true)
      setProgress(null)
      try {
        setResult(await task())
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [],
  )
  return { result, error, busy, progress, setProgress, setError, run }
}

export function ResultBox({ result }: { result: { name: string; data: Uint8Array }[] | null }) {
  if (!result) return null
  const download = () => {
    if (result.length === 1) {
      downloadBlob(result[0].data, result[0].name)
    } else {
      const zip = zipFiles(result.map((r) => ({ name: r.name, data: r.data })))
      downloadBlob(zip, 'output.zip')
    }
  }
  return (
    <div className="result">
      <p>
        Done: {result.length} file{result.length > 1 ? 's' : ''} ({formatBytes(result.reduce((a, r) => a + r.data.byteLength, 0))})
      </p>
      <ol>
        {result.map((r) => (
          <li key={r.name}>{r.name} ({formatBytes(r.data.byteLength)})</li>
        ))}
      </ol>
      <button onClick={download}>Download</button>
    </div>
  )
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="error" role="alert">{error}</div>
}

export function Files({ files, onChange, accept }: { files: LoadedFile[]; onChange: (f: LoadedFile[]) => void; accept: string }) {
  const add = async (list: FileList | null) => {
    if (!list) return
    const loaded = await Promise.all([...list].map(fileToLoaded))
    onChange([...files, ...loaded])
  }
  return (
    <div>
      <input type="file" accept={accept} multiple onChange={(e) => add(e.target.files)} />
      <ul>
        {files.map((f, i) => (
          <li key={i}>
            {f.name} ({formatBytes(f.size)}){' '}
            <button onClick={() => onChange([...files.slice(0, i - 1), files[i], files[i - 1], ...files.slice(i + 1)])} disabled={i === 0}>up</button>{' '}
            <button onClick={() => onChange([...files.slice(0, i + 1), files[i + 1], files[i], ...files.slice(i + 2)])} disabled={i === files.length - 1}>down</button>{' '}
            <button onClick={() => onChange(files.filter((_, j) => j !== i))}>remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function RunButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button type="submit" disabled={busy}>{busy ? 'Working…' : children}</button>
}
