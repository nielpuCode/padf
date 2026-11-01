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
      <button
        onClick={download}
        className="mt-2 inline-flex items-center rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#333] active:scale-[0.98]"
      >
        Download
      </button>
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
      <input
        type="file"
        accept={accept}
        multiple
        onChange={(e) => add(e.target.files)}
        className="w-full cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-[#333]"
      />
      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
          {files.map((f, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-body">{f.name} <span className="text-muted">({formatBytes(f.size)})</span></span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onChange([...files.slice(0, i - 1), files[i], files[i - 1], ...files.slice(i + 1)])}
                  disabled={i === 0}
                  className="rounded-md border border-line px-2 py-0.5 text-xs text-body transition hover:bg-black/[0.04] active:scale-[0.98] disabled:opacity-40"
                >
                  up
                </button>{' '}
                <button
                  type="button"
                  onClick={() => onChange([...files.slice(0, i + 1), files[i + 1], files[i], ...files.slice(i + 2)])}
                  disabled={i === files.length - 1}
                  className="rounded-md border border-line px-2 py-0.5 text-xs text-body transition hover:bg-black/[0.04] active:scale-[0.98] disabled:opacity-40"
                >
                  down
                </button>{' '}
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  className="rounded-md border border-line px-2 py-0.5 text-xs text-errtx transition hover:bg-black/[0.04] active:scale-[0.98]"
                >
                  remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field block">
      <span className="mb-1 block text-[13px] text-muted">{label}</span>
      {children}
    </label>
  )
}

export function RunButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex w-full items-center justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#333] active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 sm:w-auto"
    >
      {busy ? 'Working…' : children}
    </button>
  )
}
