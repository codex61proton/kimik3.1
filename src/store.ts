import { create } from 'zustand'
import { initialMarkets, type Market } from './data/zones'

interface State {
  hovered: number | null
  locked: number | null
  placed: number[]
  placePulse: number
  markets: Record<number, Market>
  toast: { id: number; text: string } | null
  setHovered: (id: number | null) => void
  lock: (id: number) => void
  toggleLock: (id: number) => void
  release: () => void
  place: () => void
  tick: () => void
}

let hoverTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<State>((set, get) => ({
  hovered: null,
  locked: null,
  placed: [],
  placePulse: 0,
  markets: initialMarkets(),
  toast: null,

  // Leaving a zone keeps the preview briefly so the pointer can reach the panel button.
  setHovered: (id) => {
    clearTimeout(hoverTimer)
    if (id !== null) set({ hovered: id })
    else hoverTimer = setTimeout(() => set({ hovered: null }), 900)
  },
  lock: (id) => set({ locked: id, hovered: null }),
  toggleLock: (id) => set((s) => ({ locked: s.locked === id ? null : id, hovered: null })),
  release: () => set({ locked: null, hovered: null }),
  place: () => {
    const { locked, placed, markets } = get()
    if (locked === null) return
    set({
      placed: placed.includes(locked) ? placed : [...placed, locked],
      placePulse: get().placePulse + 1,
      toast: {
        id: Date.now(),
        text: `Prediction placed · Z${String(locked).padStart(2, '0')} @ ${markets[locked].odds.toFixed(2)}`,
      },
    })
  },
  tick: () =>
    set((s) => {
      const markets: Record<number, Market> = {}
      for (const [k, m] of Object.entries(s.markets)) {
        const drift = Math.random() < 0.35 ? (Math.random() - 0.5) * 0.03 : 0
        const odds = Math.min(18, Math.max(1.4, +(m.odds * (1 + drift)).toFixed(2)))
        markets[+k] = {
          odds,
          volume: +(m.volume + Math.random() * 0.6).toFixed(1),
          momentum: Math.max(-19, Math.min(19, m.momentum + (Math.random() < 0.25 ? Math.round((Math.random() - 0.5) * 3) : 0))),
          delta: Math.max(2, Math.min(48, m.delta + (Math.random() < 0.3 ? Math.round((Math.random() - 0.5) * 3) : 0))),
        }
      }
      return { markets }
    }),
}))

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
