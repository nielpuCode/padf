// Parse "1-3,5,7-" style ranges into 1-based page indices.
export function parseRange(spec: string, total: number): number[] {
  const set = new Set<number>()
  for (const partRaw of spec.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const m = part.match(/^(\d+)?\s*[-–]\s*(\d+)?$/)
    if (m) {
      const [, a, b] = m
      const start = a ? parseInt(a, 10) : 1
      const end = b ? parseInt(b, 10) : total
      if (!a && !b) throw new Error(`Invalid range "${part}"`)
      if (start < 1) throw new Error(`Page numbers start at 1 (got "${part}")`)
      if (start > total) throw new Error(`Range "${part}" exceeds page count ${total}`)
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      if (hi > total) throw new Error(`Range "${part}" exceeds page count ${total}`)
      for (let i = lo; i <= hi; i++) set.add(i)
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      if (n < 1) throw new Error(`Page numbers start at 1 (got ${n})`)
      if (n > total) throw new Error(`Page ${n} exceeds page count ${total}`)
      set.add(n)
    } else {
      throw new Error(`Invalid range "${part}"`)
    }
  }
  if (set.size === 0) throw new Error('No pages selected')
  return [...set].sort((a, b) => a - b)
}

// Expand to all pages outside the given selection (for delete).
export function inverseRange(indices: number[], total: number): number[] {
  const skip = new Set(indices)
  const out: number[] = []
  for (let i = 1; i <= total; i++) if (!skip.has(i)) out.push(i)
  return out
}
