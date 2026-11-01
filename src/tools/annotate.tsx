import { useState } from 'react'
import { savePdf } from '../lib/pdf'
import { stripExtension } from '../lib/zip'
import { addPageNumbers, addHeaderFooter, addTextWatermark, type NumberOptions, type HeaderFooterOptions, type WatermarkOptions } from '../lib/ops/layout'
import { OneFileRangeScreen } from './geometry'
import { Labeled } from '../components/ui'

export function PageNumbersScreen() {
  const [opts, setOpts] = useState<{ start: string; format: string; font: string; margin: string; position: 'top' | 'bottom'; align: 'left' | 'center' | 'right' }>({
    start: '1', format: '{page} / {total}', font: '10', margin: '24', position: 'bottom', align: 'center',
  })
  const s = Number(opts.start), f = Number(opts.font), m = Number(opts.margin)
  return (
    <OneFileRangeScreen
      title="Page numbers"
      form={(
        <>
          <Labeled label="Start numbering at"><input type="number" min="0" value={opts.start} onChange={(e) => setOpts({ ...opts, start: e.target.value })} /></Labeled>
          <Labeled label="Format ({page}, {total} tokens)"><input type="text" value={opts.format} onChange={(e) => setOpts({ ...opts, format: e.target.value })} /></Labeled>
          <Labeled label="Font size"><input type="number" min="1" max="144" value={opts.font} onChange={(e) => setOpts({ ...opts, font: e.target.value })} /></Labeled>
          <Labeled label="Margin (pt)"><input type="number" min="0" value={opts.margin} onChange={(e) => setOpts({ ...opts, margin: e.target.value })} /></Labeled>
          <Labeled label="Position">
            <select value={opts.position} onChange={(e) => setOpts({ ...opts, position: e.target.value as 'top' | 'bottom' })}>
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </Labeled>
          <Labeled label="Align">
            <select value={opts.align} onChange={(e) => setOpts({ ...opts, align: e.target.value as 'left' | 'center' | 'right' })}>
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </Labeled>
        </>
      )}
      run={async (bytes, pw) => {
        if (!opts.format) throw new Error('Format is required')
        const doc = await addPageNumbers(bytes, { start: s, format: opts.format, font: f, margin: m, position: opts.position, align: opts.align } satisfies NumberOptions, pw)
        return { data: await savePdf(doc), extra: '-numbered' }
      }}
    />
  )
}

export function HeaderFooterScreen() {
  const [opts, setOpts] = useState<Record<keyof HeaderFooterOptions, string>>({
    headerLeft: '', headerCenter: '', headerRight: '',
    footerLeft: '', footerCenter: '', footerRight: '',
    font: '9', margin: '24',
  })
  return (
    <OneFileRangeScreen
      title="Header and footer"
      hint="Tokens: {page} {total}"
      form={(
        <>
          <Labeled label="Header left"><input type="text" value={opts.headerLeft} onChange={(e) => setOpts({ ...opts, headerLeft: e.target.value })} /></Labeled>
          <Labeled label="Header center"><input type="text" value={opts.headerCenter} onChange={(e) => setOpts({ ...opts, headerCenter: e.target.value })} /></Labeled>
          <Labeled label="Header right"><input type="text" value={opts.headerRight} onChange={(e) => setOpts({ ...opts, headerRight: e.target.value })} /></Labeled>
          <Labeled label="Footer left"><input type="text" value={opts.footerLeft} onChange={(e) => setOpts({ ...opts, footerLeft: e.target.value })} /></Labeled>
          <Labeled label="Footer center"><input type="text" value={opts.footerCenter} onChange={(e) => setOpts({ ...opts, footerCenter: e.target.value })} /></Labeled>
          <Labeled label="Footer right"><input type="text" value={opts.footerRight} onChange={(e) => setOpts({ ...opts, footerRight: e.target.value })} /></Labeled>
          <Labeled label="Font size"><input type="number" min="1" max="72" value={opts.font} onChange={(e) => setOpts({ ...opts, font: e.target.value })} /></Labeled>
          <Labeled label="Margin (pt)"><input type="number" min="0" value={opts.margin} onChange={(e) => setOpts({ ...opts, margin: e.target.value })} /></Labeled>
        </>
      )}
      run={async (bytes, pw) => {
        const filled = Object.fromEntries(Object.entries(opts).filter(([k, v]) => v !== '' && k !== 'font' && k !== 'margin'))
        if (!Object.keys(filled).length) throw new Error('Fill at least one field')
        const doc = await addHeaderFooter(bytes, { ...filled, font: Number(opts.font), margin: Number(opts.margin) } as unknown as HeaderFooterOptions, pw)
        return { data: await savePdf(doc), extra: '-annotated' }
      }}
    />
  )
}

export function WatermarkScreen() {
  const [opts, setOpts] = useState<{ text: string; fontSize: string; opacity: string; angle: string; tile: boolean; fontSizeIsFraction: boolean }>({
    text: 'CONFIDENTIAL', fontSize: '0.18', opacity: '0.15', angle: '45', tile: false, fontSizeIsFraction: true,
  })
  return (
    <OneFileRangeScreen
      title="Watermark (text)"
      hint={'Font size is a fraction of page width unless "absolute pt" is chosen.'}
      form={(
        <>
          <Labeled label="Text"><input type="text" required value={opts.text} onChange={(e) => setOpts({ ...opts, text: e.target.value })} /></Labeled>
          <Labeled label="Font size">
            <input type="number" step="0.01" min="0.01" value={opts.fontSize} onChange={(e) => setOpts({ ...opts, fontSize: e.target.value })} />
          </Labeled>
          <Labeled label="Size mode">
            <select value={opts.fontSizeIsFraction ? 'fraction' : 'pt'} onChange={(e) => setOpts({ ...opts, fontSizeIsFraction: e.target.value === 'fraction' })}>
              <option value="fraction">Fraction of page width</option>
              <option value="pt">Absolute pt</option>
            </select>
          </Labeled>
          <Labeled label="Opacity (0-1)"><input type="number" step="0.05" min="0.05" max="1" value={opts.opacity} onChange={(e) => setOpts({ ...opts, opacity: e.target.value })} /></Labeled>
          <Labeled label="Angle (degrees)"><input type="number" step="1" min="-90" max="90" value={opts.angle} onChange={(e) => setOpts({ ...opts, angle: e.target.value })} /></Labeled>
          <Labeled label="Tile across page"><input type="checkbox" checked={opts.tile} onChange={(e) => setOpts({ ...opts, tile: e.target.checked })} /></Labeled>
        </>
      )}
      run={async (bytes, pw) => {
        const w: WatermarkOptions = {
          text: opts.text,
          fontSize: Number(opts.fontSize),
          opacity: Number(opts.opacity),
          angle: Number(opts.angle),
          tile: opts.tile,
          fontSizeIsFraction: opts.fontSizeIsFraction,
        }
        const doc = await addTextWatermark(bytes, w, pw)
        return { data: await savePdf(doc), extra: '-watermarked' }
      }}
    />
  )
}
