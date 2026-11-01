import { useState, useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import type { Icon } from '@phosphor-icons/react'
import {
  Stack, Scissors, ArrowsIn, Broom, LockKey, LockKeyOpen, Export, TrashSimple,
  ArrowsDownUp, ArrowClockwise, Crop, FrameCorners, PlusSquare, SquaresFour,
  BookOpen, ImageSquare, FileImage, Hash, Rows, Drop,
  ShieldCheck, WifiSlash, Lightning, MagnifyingGlass, File,
} from '@phosphor-icons/react'
import { MergeScreen, SplitScreen, CompressScreen, PasswordScreen, UnlockScreen } from './tools/tier0'
import { ExtractScreen, DeleteScreen, ReorderScreen, RotateScreen, CropScreen, ResizeScreen } from './tools/geometry'
import { InsertScreen, NUpScreen, BookletScreen } from './tools/compose'
import { ImagesToPdfScreen, PdfToImagesScreen, BasicCompressScreen } from './tools/media'
import { PageNumbersScreen, HeaderFooterScreen, WatermarkScreen } from './tools/annotate'

type Group = 'core' | 'pages' | 'layout' | 'media' | 'annotate'
type GroupMeta = { tier: string; label: string; look: string }
const GROUPS: Record<Group, GroupMeta> = {
  core: { tier: 'Tier 0', label: 'Core', look: 'bg-[#E1F3FE] text-[#1F6C9F]' },
  pages: { tier: 'Tier 1', label: 'Pages', look: 'bg-[#EDF3EC] text-[#346538]' },
  layout: { tier: 'Tier 1', label: 'Layout', look: 'bg-[#FBF3DB] text-[#956400]' },
  media: { tier: 'Tier 1', label: 'Media', look: 'bg-[#FDEBEC] text-[#9F2F2D]' },
  annotate: { tier: 'Tier 1', label: 'Annotate', look: 'bg-[#F1F1EF] text-muted' },
}

type Tool = { id: string; name: string; group: Group; icon: Icon; desc: string }

const TOOLS: Tool[] = [
  { id: 'merge', name: 'Merge PDFs', group: 'core', icon: Stack, desc: 'Combine several PDFs into one, in your chosen order' },
  { id: 'split', name: 'Split PDF', group: 'core', icon: Scissors, desc: 'Break one PDF into parts by pages, ranges or size' },
  { id: 'compress-flatten', name: 'Compress (flatten)', group: 'core', icon: ArrowsIn, desc: 'Render pages as images for real size reduction' },
  { id: 'compress-basic', name: 'Recompress (basic)', group: 'core', icon: Broom, desc: 'Lossless re-save. Small gains, text stays text' },
  { id: 'protect', name: 'Password protect', group: 'core', icon: LockKey, desc: 'AES-256 password with permissions' },
  { id: 'unlock', name: 'Remove password', group: 'core', icon: LockKeyOpen, desc: 'Remove a password you already know' },
  { id: 'extract', name: 'Extract pages', group: 'pages', icon: Export, desc: 'Copy selected pages into a new PDF' },
  { id: 'delete', name: 'Delete pages', group: 'pages', icon: TrashSimple, desc: 'Remove pages and keep the rest' },
  { id: 'reorder', name: 'Reorder pages', group: 'pages', icon: ArrowsDownUp, desc: 'Rearrange pages into any order you type' },
  { id: 'rotate', name: 'Rotate pages', group: 'pages', icon: ArrowClockwise, desc: 'Turn pages by 90, 180 or 270 degrees' },
  { id: 'crop', name: 'Crop pages', group: 'pages', icon: Crop, desc: 'Trim page edges in points' },
  { id: 'resize', name: 'Resize pages', group: 'pages', icon: FrameCorners, desc: 'Scale content onto A4, Letter, A5 or A3' },
  { id: 'insert', name: 'Insert another PDF', group: 'layout', icon: PlusSquare, desc: 'Place another PDF at any page position' },
  { id: 'nup', name: 'N-up pages per sheet', group: 'layout', icon: SquaresFour, desc: 'Put 2, 4 or 6 pages on one sheet' },
  { id: 'booklet', name: 'Booklet imposition', group: 'layout', icon: BookOpen, desc: 'Reorder pages for saddle-stitch duplex printing' },
  { id: 'images-to-pdf', name: 'Images to PDF', group: 'media', icon: ImageSquare, desc: 'Turn JPG or PNG files into one PDF' },
  { id: 'pdf-to-images', name: 'PDF to images', group: 'media', icon: FileImage, desc: 'Render pages to PNG or JPEG at chosen DPI' },
  { id: 'numbers', name: 'Page numbers', group: 'annotate', icon: Hash, desc: 'Stamp {page} {total} numbering on pages' },
  { id: 'header-footer', name: 'Header and footer', group: 'annotate', icon: Rows, desc: 'Running headers and footers with tokens' },
  { id: 'watermark', name: 'Watermark', group: 'annotate', icon: Drop, desc: 'Cover pages with a faded text mark' },
]

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
const EASE = [0.16, 1, 0.3, 1] as const

const heroMotion = (delay: number) => ({
  initial: enter,
  animate: show,
  transition: { delay, duration: 0.55, ease: EASE },
})

function ToolList() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = (t: Tool) => !q || `${t.name} ${t.desc}`.toLowerCase().includes(q)
  const groups = (Object.keys(GROUPS) as Group[]).filter((g) =>
    TOOLS.some((t) => t.group === g && visible(t)),
  )
  return (
    <main className="list">
      <motion.div {...heroMotion(0)} className="banner">
        <div className="flex items-center justify-between">
          <span className="chip !bg-white/10 !text-white" style={{ fontWeight: 600 }}>
            <File size={13} weight="bold" /> padf
          </span>
          <span className="chip">
            <WifiSlash size={13} weight="bold" /> Offline after load
          </span>
        </div>
        <h1 className="hero-title mt-6">
          padf<span className="text-[#8FC3E8]">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white" style={{ lineHeight: 1.4 }}>
          PDF tools that never leave your device.
        </p>
        <p className="mt-2 max-w-xl text-sm text-white/60">
          Merge, split, compress, protect and {TOOLS.length - 6} more operations, all in your
          browser. No upload, no account, no queue.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip">
            <ShieldCheck size={13} weight="bold" className="text-[#9DC79D]" /> No upload
          </span>
          <span className="chip">
            <WifiSlash size={13} weight="bold" className="text-[#8FC3E8]" /> Works offline
          </span>
          <span className="chip">
            <Lightning size={13} weight="bold" className="text-[#D8C289]" /> Instant results
          </span>
          <span className="chip">
            <LockKey size={13} weight="bold" className="text-[#DDA09E]" /> AES-256 protect
          </span>
        </div>
        <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
          {(
            [
              { icon: ShieldCheck, cls: 'text-[#8FC3E8]', title: 'Confidential by design', desc: 'Processing happens on your device. Files never touch a server.' },
              { icon: WifiSlash, cls: 'text-[#9DC79D]', title: 'Airplane-mode proof', desc: 'The app is fully self-contained. Load it once, use it offline.' },
              { icon: Lightning, cls: 'text-[#D8C289]', title: 'No queue, no limits', desc: 'No rounds of upload waits. Results in the time it takes to compute.' },
            ] as const
          ).map((tile) => (
            <div key={tile.title} className="flex gap-3">
              <span className={`mt-0.5 shrink-0 ${tile.cls}`}>
                <tile.icon size={20} weight="bold" />
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{tile.title}</span>
                <span className="block text-[12.5px] leading-snug text-white/50">{tile.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="relative mt-8">
        <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          className="tool-search"
          placeholder={`Search ${TOOLS.length} tools...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {groups.map((g) => (
        <section key={g} className="mb-8 mt-8">
          <h3 className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-[0.06em] uppercase ${GROUPS[g].look}`}>
              {GROUPS[g].label}
            </span>
            {GROUPS[g].tier}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.filter((t) => t.group === g && visible(t)).map((t, i) => (
              <motion.li
                key={t.id}
                initial={enter}
                animate={show}
                transition={{ delay: 0.03 * i, duration: 0.5, ease: EASE }}
              >
                <a
                  href={`#/${t.id}`}
                  className="group flex h-full gap-3 rounded-lg border border-line bg-surface p-4 transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99]"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${GROUPS[t.group].look}`}>
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
      {q && groups.length === 0 && <p className="hint mt-8">No tool matches "{query}".</p>}
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
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${GROUPS[tool.group].look}`}>
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
            transition={{ duration: 0.35, ease: EASE }}
          >
            <ToolPage id={active} />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={enter}
            animate={show}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <ToolList />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
