export const PITCH_W = 6.8
export const PITCH_L = 10.5
export const COLS = 4
export const ROWS = 6
export const GAP = 0.085

export type Category = 'flank' | 'box' | 'central'

export interface ZoneDef {
  id: number
  code: string
  row: number
  col: number
  x: number
  z: number
  w: number
  l: number
  name: string
  category: Category
  color: string
}

const ROW_NAMES = ['Goal Mouth', 'Box Edge', 'Final Third', 'Half-Space', 'Midfield Pivot', 'Build-Up']
const COL_TAGS = ['L', 'LC', 'RC', 'R']

function zoneColor(row: number, col: number) {
  const outer = col === 0 || col === 3
  if (row === 0) return '#a59a78'
  if (row === 1) return '#c39a3e'
  if (row <= 3) return outer ? '#2b67ad' : '#5b8590'
  if (row === 4) return outer ? '#2f6db6' : '#4f8196'
  return outer ? '#2a63b4' : '#3570b8'
}

function zoneMeta(row: number, col: number): { name: string; category: Category } {
  const outer = col === 0 || col === 3
  const side = col < 2 ? 'Left' : 'Right'
  if (row <= 1) return { name: `${ROW_NAMES[row]} · ${COL_TAGS[col]}`, category: 'box' }
  if (outer && row !== 4) return { name: `${side} Wing · ${ROW_NAMES[row]}`, category: 'flank' }
  return { name: `${ROW_NAMES[row]} · ${COL_TAGS[col]}`, category: 'central' }
}

const cellW = PITCH_W / COLS
const cellL = PITCH_L / ROWS

export const ZONES: ZoneDef[] = Array.from({ length: ROWS * COLS }, (_, i) => {
  const row = Math.floor(i / COLS)
  const col = i % COLS
  const id = i + 1
  return {
    id,
    code: `Z${String(id).padStart(2, '0')}`,
    row,
    col,
    x: -PITCH_W / 2 + cellW * (col + 0.5),
    z: -PITCH_L / 2 + cellL * (row + 0.5),
    w: cellW - GAP,
    l: cellL - GAP,
    color: zoneColor(row, col),
    ...zoneMeta(row, col),
  }
})

export const CATEGORY_LABEL: Record<Category, string> = {
  flank: 'Flank',
  box: 'Keeper/Box',
  central: 'Central',
}

export const CATEGORY_DOT: Record<Category, string> = {
  flank: '#9fb7c9',
  box: '#e0b552',
  central: '#e8a64a',
}

export interface Market {
  odds: number
  volume: number // in thousands €
  momentum: number // % over 5m
  delta: number // index change %
}

// Seeded PRNG so the board looks identical on every load.
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRESET: Record<number, Partial<Market>> = {
  24: { odds: 12.5, volume: 81.2, momentum: -7 },
  19: { odds: 7.23, volume: 291.1, momentum: 11 },
  20: { odds: 9.2, volume: 236.6, momentum: -4 },
  16: { odds: 3.13, delta: 28 },
  5: { odds: 3.18, delta: 34 },
  11: { odds: 3.19, delta: 38 },
  15: { odds: 5.12, delta: 12 },
  12: { odds: 3.47, delta: 36 },
  14: { odds: 5.24, delta: 17 },
  9: { odds: 3.19, delta: 29 },
}

export function initialMarkets(): Record<number, Market> {
  const rnd = mulberry32(24)
  const out: Record<number, Market> = {}
  for (const z of ZONES) {
    const base: Market = {
      odds: +(2.4 + rnd() * 11).toFixed(2),
      volume: +(40 + rnd() * 280).toFixed(1),
      momentum: Math.round(-14 + rnd() * 28),
      delta: Math.round(8 + rnd() * 32),
    }
    out[z.id] = { ...base, ...PRESET[z.id] }
  }
  return out
}

export const INDEX_ZONES = [16, 5, 11, 15, 12, 14, 9]
