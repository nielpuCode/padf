import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { MergeScreen, SplitScreen, CompressScreen, PasswordScreen, UnlockScreen } from './tools/tier0'
import { ExtractScreen, DeleteScreen, ReorderScreen, RotateScreen, CropScreen, ResizeScreen } from './tools/geometry'
import { InsertScreen, NUpScreen, BookletScreen } from './tools/compose'
import { ImagesToPdfScreen, PdfToImagesScreen, BasicCompressScreen } from './tools/media'
import { PageNumbersScreen, HeaderFooterScreen, WatermarkScreen } from './tools/annotate'

type Tool = { id: string; name: string; group: Group }
type Group = 'Tier 0 — core' | 'Tier 1 — pages' | 'Tier 1 — layout' | 'Tier 1 — media' | 'Tier 1 — annotate'

const TOOLS: Tool[] = [
  { id: 'merge', name: 'Merge PDFs', group: 'Tier 0 — core' },
  { id: 'split', name: 'Split PDF', group: 'Tier 0 — core' },
  { id: 'compress-flatten', name: 'Compress (flatten, lossy)', group: 'Tier 0 — core' },
  { id: 'compress-basic', name: 'Recompress (basic, lossless)', group: 'Tier 0 — core' },
  { id: 'protect', name: 'Password protect', group: 'Tier 0 — core' },
  { id: 'unlock', name: 'Remove password', group: 'Tier 0 — core' },
  { id: 'extract', name: 'Extract pages', group: 'Tier 1 — pages' },
  { id: 'delete', name: 'Delete pages', group: 'Tier 1 — pages' },
  { id: 'reorder', name: 'Reorder pages', group: 'Tier 1 — pages' },
  { id: 'rotate', name: 'Rotate pages', group: 'Tier 1 — pages' },
  { id: 'crop', name: 'Crop pages', group: 'Tier 1 — pages' },
  { id: 'resize', name: 'Resize pages', group: 'Tier 1 — pages' },
  { id: 'insert', name: 'Insert another PDF', group: 'Tier 1 — layout' },
  { id: 'nup', name: 'N-up pages per sheet', group: 'Tier 1 — layout' },
  { id: 'booklet', name: 'Booklet imposition', group: 'Tier 1 — layout' },
  { id: 'images-to-pdf', name: 'Images to PDF', group: 'Tier 1 — media' },
  { id: 'pdf-to-images', name: 'PDF to images', group: 'Tier 1 — media' },
  { id: 'numbers', name: 'Page numbers', group: 'Tier 1 — annotate' },
  { id: 'header-footer', name: 'Header and footer', group: 'Tier 1 — annotate' },
  { id: 'watermark', name: 'Watermark', group: 'Tier 1 — annotate' },
]

// Static import keeps the bundle single-chunk for wasm/CSP simplicity; pdfjs is dynamically imported inside raster ops only.
const SCREENS: Record<string, ComponentType> = {
  merge: MergeScreen, split: SplitScreen, 'compress-flatten': CompressScreen,
  'compress-basic': BasicCompressScreen, protect: PasswordScreen, unlock: UnlockScreen,
  extract: ExtractScreen, delete: DeleteScreen, reorder: ReorderScreen, rotate: RotateScreen,
  crop: CropScreen, resize: ResizeScreen, insert: InsertScreen, nup: NUpScreen, booklet: BookletScreen,
  'images-to-pdf': ImagesToPdfScreen, 'pdf-to-images': PdfToImagesScreen,
  numbers: PageNumbersScreen, 'header-footer': HeaderFooterScreen, watermark: WatermarkScreen,
}

function currentTool(): string | null {
  const id = window.location.hash.replace(/^#\/?/, '')
  return TOOLS.some((t) => t.id === id) ? id : null
}

function ToolList() {
  const groups = [...new Set(TOOLS.map((t) => t.group))]
  return (
    <main className="list fade-in">
      <h1>padf</h1>
      <p className="tagline">PDF tools that never leave your device.</p>
      <p className="hint mb-8">
        All processing happens in your browser. Files never leave your device.
        After this page loads, it works offline.
      </p>
      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h3 className="mb-2">{g}</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.filter((t) => t.group === g).map((t) => (
              <li key={t.id}>
                <a
                  href={`#/${t.id}`}
                  className="block rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-body transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99]"
                >
                  {t.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

export default function App() {
  const [active, setActive] = useState<string | null>(currentTool())
  useEffect(() => {
    const onHash = () => setActive(currentTool())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!active) return <ToolList />
  const Screen = SCREENS[active]
  return (
    <main className="tool-wrap fade-in">
      <a href="#/" className="text-sm text-muted transition hover:text-ink">&larr; All tools</a>
      <Screen key={active} />
    </main>
  )
}
