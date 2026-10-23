import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CATEGORY_DOT, CATEGORY_LABEL, INDEX_ZONES, ZONES } from '../data/zones'
import { useStore } from '../store'

const fade = {
  initial: { opacity: 0, y: -8, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] as const },
}

function Brand() {
  return (
    <motion.div className="brand" {...fade}>
      <div className="brand-mark">Z</div>
      <div>
        <div className="brand-name">ZONE//24</div>
        <div className="brand-sub">Prediction Terminal</div>
      </div>
    </motion.div>
  )
}

function Scoreboard() {
  const [secs, setSecs] = useState(67 * 60 + 33)
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const mm = Math.floor(secs / 60)
  const ss = String(secs % 60).padStart(2, '0')
  return (
    <motion.div className="glass score" {...fade} transition={{ ...fade.transition, delay: 0.1 }}>
      <span className="live">
        <i /> Live
      </span>
      <span className="team">Real Madrid</span>
      <span className="result">
        2 <em>–</em> 1
      </span>
      <span className="team">Man City</span>
      <span className="clock">
        {mm}:{ss}
      </span>
    </motion.div>
  )
}

function MarketIndex() {
  const markets = useStore((s) => s.markets)
  const locked = useStore((s) => s.locked)
  const lock = useStore((s) => s.lock)
  return (
    <motion.div className="glass index" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.25 }}>
      <div className="index-head">
        <span>Live Market Index</span>
        <span>Vol ▴</span>
      </div>
      <ul>
        {INDEX_ZONES.map((id) => {
          const z = ZONES[id - 1]
          const m = markets[id]
          return (
            <li key={id} className={locked === id ? 'active' : ''} onClick={() => lock(id)}>
              <i style={{ background: CATEGORY_DOT[z.category] }} />
              <span className="code">{z.code}</span>
              <Ticker value={m.odds} />
              <span className="delta">+{m.delta}%</span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

function Ticker({ value, className = 'odds' }: { value: number; className?: string }) {
  const [prev, setPrev] = useState(value)
  const [dir, setDir] = useState<0 | 1 | -1>(0)
  useEffect(() => {
    if (value === prev) return
    setDir(value > prev ? 1 : -1)
    setPrev(value)
    const t = setTimeout(() => setDir(0), 700)
    return () => clearTimeout(t)
  }, [value, prev])
  return <span className={`${className} ${dir > 0 ? 'up' : dir < 0 ? 'down' : ''}`}>{value.toFixed(2)}</span>
}

function Bar({ value, gradient }: { value: number; gradient?: boolean }) {
  return (
    <div className={`bar ${gradient ? 'grad' : ''}`}>
      <motion.div className="fill" initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  )
}

function MarketPanel() {
  const hovered = useStore((s) => s.hovered)
  const locked = useStore((s) => s.locked)
  const markets = useStore((s) => s.markets)
  const placed = useStore((s) => s.placed)
  const lock = useStore((s) => s.lock)
  const release = useStore((s) => s.release)
  const place = useStore((s) => s.place)

  const shown = hovered ?? locked
  const isLocked = shown !== null && shown === locked
  const zone = shown !== null ? ZONES[shown - 1] : null
  const m = shown !== null ? markets[shown] : null
  const isPlaced = shown !== null && placed.includes(shown)

  return (
    <motion.div className="glass panel" layout transition={{ layout: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } }}>
      <AnimatePresence mode="wait" initial={false}>
        {!zone || !m ? (
          <motion.div key="empty" className="panel-empty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <h3>Select a zone</h3>
            <p>
              Hover any of the <b>24 pitch zones</b> to preview live odds. <kbd>Click</kbd> to lock a zone and open its market. <kbd>Esc</kbd> to release.
            </p>
          </motion.div>
        ) : (
          <motion.div key={zone.id} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }} transition={{ duration: 0.22 }}>
            <div className="panel-top">
              <div className="eyebrow">
                {zone.code} · Zone Market
              </div>
              {isLocked && (
                <button className="close" aria-label="Release zone" onClick={release}>
                  ×
                </button>
              )}
            </div>
            <h2>{zone.name}</h2>
            <div className="cat">{CATEGORY_LABEL[zone.category]}</div>
            <div className="odds-row">
              <Ticker value={m.odds} className={`big-odds ${isLocked ? 'locked' : ''}`} />
              <div className="odds-meta">
                <span>Decimal odds</span>
                <span>Implied {(100 / m.odds).toFixed(1)}%</span>
              </div>
            </div>
            <div className="stat">
              <span>Matched volume</span>
              <b>€{m.volume.toFixed(1)}K</b>
            </div>
            <Bar value={m.volume / 3.4} />
            <div className="stat">
              <span>Momentum 5m</span>
              <b className={m.momentum >= 0 ? 'pos' : 'neg'}>
                {m.momentum >= 0 ? '▲ +' : '▼ '}
                {m.momentum}%
              </b>
            </div>
            <Bar value={50 + m.momentum * 2.4} gradient />
            <motion.button
              className={`cta ${isPlaced ? 'done' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => (isLocked ? place() : lock(zone.id))}
            >
              <span className="shine" />
              {isLocked ? (isPlaced ? '✓ Prediction placed' : 'Place prediction') : 'Click to lock zone'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Legend() {
  return (
    <motion.div className="glass legend" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
      <span>
        <i style={{ background: CATEGORY_DOT.flank }} /> Flank Z01–04
      </span>
      <span>
        <i style={{ background: CATEGORY_DOT.box }} /> Keeper/Box Z05–08
      </span>
      <span>
        <i style={{ background: CATEGORY_DOT.central }} /> Central Z09–24
      </span>
    </motion.div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  const [visible, setVisible] = useState<typeof toast>(null)
  useEffect(() => {
    if (!toast) return
    setVisible(toast)
    const t = setTimeout(() => setVisible(null), 2600)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <AnimatePresence>
      {visible && (
        <motion.div key={visible.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
          <i /> {visible.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Hud() {
  const tick = useStore((s) => s.tick)
  const release = useStore((s) => s.release)
  useEffect(() => {
    const t = setInterval(tick, 1600)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && release()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [tick, release])

  return (
    <div className="hud">
      <header className="hud-top">
        <Brand />
        <Scoreboard />
      </header>
      <MarketIndex />
      <MarketPanel />
      <Legend />
      <div className="meta">
        <span>Regol · Three.js R3F</span>
        <span>24-Zone Tactical Model · 60FPS</span>
      </div>
      <Toast />
    </div>
  )
}
