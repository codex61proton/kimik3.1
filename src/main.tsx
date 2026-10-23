import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useProgress } from '@react-three/drei'
import { AnimatePresence, motion } from 'motion/react'
import { Experience } from './scene/Experience'
import { Hud } from './ui/Hud'
import './styles.css'

function Loader() {
  const { active, progress } = useProgress()
  return (
    <AnimatePresence>
      {active && (
        <motion.div className="loader" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          Booting terminal · {Math.round(progress)}%
        </motion.div>
      )}
    </AnimatePresence>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Experience />
    <div className="overlay" />
    <Hud />
    <Loader />
  </StrictMode>,
)
