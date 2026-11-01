import { useState, useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import type { Icon } from '@phosphor-icons/react'
import {
  Stack, Scissors, ArrowsIn, Broom, LockKey, LockKeyOpen, Export, TrashSimple,
  ArrowsDownUp, ArrowClockwise, Crop, FrameCorners, PlusSquare, SquaresFour,
  BookOpen, ImageSquare, FileImage, Hash, Rows, Drop,
} from '@phosphor-icons/react'
import { MergeScreen, SplitScreen, CompressScreen, PasswordScreen, UnlockScreen } from './tools/tier0'
import { ExtractScreen, DeleteScreen, ReorderScreen, RotateScreen, CropScreen, ResizeScreen } from './tools/geometry'
import { InsertScreen, NUpScreen, BookletScreen } from './tools/compose'
import { ImagesToPdfScreen, PdfToImagesScreen, BasicCompressScreen } from './tools/media'
import { PageNumbersScreen, HeaderFooterScreen, WatermarkScreen } from './tools/annotate'

type Group = 'Tier 0 — core' | 'Tier 1 — pages' | 'Tier 1 — layout' | 'Tier 1 — media' | 'Tier 1 — annotate'
type Tool = { id: string; name: string; group: Group; icon: Icon; desc: string }

const TOOLS: Tool[] = [
  { id: 'merge', name: 'Merge PDFs', group: 'Tier 0 — core', icon: Stack, desc: 'Combine several PDFs into one, in your chosen order' },
  { id: 'split', name: 'Split PDF', group: 'Tier 0 — core', icon: Scissors, desc: 'Break one PDF into parts by pages, ranges or size' },
  { id: 'compress-flatten', name: 'Compress (flatten)', group: 'Tier 0 — core', icon: ArrowsIn, desc: 'Render pages as images for real size reduction' },
  { id: 'compress-basic', name: 'Recompress (basic)', group: 'Tier 0 — core', icon: Broom, desc: 'Lossless re-save; small gains, text stays text' },
  { id: 'protect', name: 'Password protect', group: 'Tier 0 — core', icon: LockKey, desc: 'AES-256 password with permissions' },
  { id: 'unlock', name: 'Remove password', group: 'Tier 0 — core', icon: LockKeyOpen, desc: 'Remove a password you already know' },
  { id: 'extract', name: 'Extract pages', group: 'Tier 1 — pages', icon: Export, desc: 'Copy selected pages into a new PDF' },
  { id: 'delete', name: 'Delete pages', group: 'Tier 1 — pages', icon: TrashSimple, desc: 'Remove pages and keep the rest' },
  { id: 'reorder', name: 'Reorder pages', group: 'Tier 1 — pages', icon: ArrowsDownUp, desc: 'Rearrange pages into any order you type' },
  { id: 'rotate', name: 'Rotate pages', group: 'Tier 1 — pages', icon: ArrowClockwise, desc: 'Turn pages by 90, 180 or 270 degrees' },
  { id: 'crop', name: 'Crop pages', group: 'Tier 1 — pages', icon: Crop, desc: 'Trim page edges in points' },
  { id: 'resize', name: 'Resize pages', group: 'Tier 1 — pages', icon: FrameCorners, desc: 'Scale content onto A4, Letter, A5 or A3' },
  { id: 'insert', name: 'Insert another PDF', group: 'Tier 1 — layout', icon: PlusSquare, desc: 'Place another PDF at any page position' },
  { id: 'nup', name: 'N-up pages per sheet', group: 'Tier 1 — layout', icon: SquaresFour, desc: 'Put 2, 4 or 6 pages on one sheet' },
  { id: 'booklet', name: 'Booklet imposition', group: 'Tier 1 — layout', icon: BookOpen, desc: 'Reorder pages for saddle-stitch duplex printing' },
  { id: 'images-to-pdf', name: 'Images to PDF', group: 'Tier 1 — media', icon: ImageSquare, desc: 'Turn JPG or PNG files into one PDF' },
  { id: 'pdf-to-images', name: 'PDF to images', group: 'Tier 1 — media', icon: FileImage, desc: 'Render pages to PNG or JPEG at chosen DPI' },
  { id: 'numbers', name: 'Page numbers', group: 'Tier 1 — annotate', icon: Hash, desc: 'Stamp {page} {total} numbering on pages' },
  { id: 'header-footer', name: 'Header and footer', group: 'Tier 1 — annotate', icon: Rows, desc: 'Running headers and footers with tokens' },
  { id: 'watermark', name: 'Watermark', group: 'Tier 1 — annotate', icon: Drop, desc: 'Cover pages with a faded text mark' },
]

const GROUP_LOOK: Record<Group, string> = {
  'Tier 0 — core': 'bg-[#E1F3FE] text-[#1F6C9F]',
  'Tier 1 — pages': 'bg-[#EDF3EC] text-[#346538]',
  'Tier 1 — layout': 'bg-[#FBF3DB] text-[#956400]',
  'Tier 1 — media': 'bg-[#FDEBEC] text-[#9F2F2D]',
  'Tier 1 — annotate': 'bg-[#F1F1EF] text-muted',
}

const SCREENS: Record<string, React.ComponentType> = {
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

const enter = { opacity: 0, y: 12 }
const show = { opacity: 1, y: 0 }

function ToolList() {
  const groups = [...new Set(TOOLS.map((t) => t.group))] as Group[]
  return (
    <main className="list">
      <h1>padf</h1>
      <p className="tagline">PDF tools that never leave your device.</p>
      <p className="hint mb-8">
        All processing happens in your browser. Files never leave your device.
        After this page loads, it works offline.
      </p>
      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h3 className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-[0.06em] uppercase ${GROUP_LOOK[g].split(' ')[0]} ${GROUP_LOOK[g].split(' ')[1]}`}>
              {g.split(' — ')[1]}
            </span>
            {g.split(' — ')[0]}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.filter((t) => t.group === g).map((t, i) => (
              <motion.li
                key={t.id}
                initial={enter}
                animate={show}
                transition={{ delay: 0.03 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <a
                  href={`#/${t.id}`}
                  className="group flex h-full gap-3 rounded-lg border border-line bg-surface p-4 transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99]"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${GROUP_LOOK[t.group]}`}>
                    <t.icon size={18} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t.desc}</span>
                  </span>
                </a>
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

function ToolPage({ id }: { id: string }) {
  const tool = TOOLS.find((t) => t.id === id)!
  const Screen = SCREENS[id]
  return (
    <main className="tool-wrap">
      <a href="#/" className="text-sm text-muted transition hover:text-ink">&larr; All tools</a>
      <div className="mt-3 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${GROUP_LOOK[tool.group]}`}>
          <tool.icon size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink" style={{ letterSpacing: '-0.02em' }}>{tool.name}</p>
          <p className="truncate text-[12.5px] text-muted">{tool.desc}</p>
        </div>
      </div>
      <Screen />
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

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.div
            key={active}
            initial={enter}
            animate={show}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ToolPage id={active} />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={enter}
            animate={show}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ToolList />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
