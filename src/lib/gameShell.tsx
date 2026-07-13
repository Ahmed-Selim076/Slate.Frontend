import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { RulesModal, LangToggle, type Bilingual } from './gameUi'
import { useLang, common } from './i18n'
import { getTheme, toggleTheme, type Theme } from './theme'

export function Centered({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`min-h-screen bg-[var(--color-bg)] flex items-center justify-center ${error ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-dim)]'}`}>
      {children}
    </div>
  )
}

export function WaitingBanner() {
  const [lang] = useLang()
  return (
    <div className="panel p-8 text-center text-[var(--color-text-dim)] max-w-md">
      {common.waitingForOpponent[lang]}
    </div>
  )
}

// Small burst of falling confetti pieces for a win screen. Pure CSS
// animation (randomized per piece via inline style), no external deps.
// Renders once and self-removes visually after the animation plays out —
// mount it conditionally (`{won && <Confetti />}`) so it replays each win.
const CONFETTI_COLORS = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-accent-3)', '#E5A15C', '#6C8CF5']

export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const items = Array.from({ length: pieces }, (_, i) => {
    const left = Math.random() * 100
    const delay = Math.random() * 0.4
    const duration = 1.8 + Math.random() * 1.2
    const size = 6 + Math.random() * 6
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const drift = (Math.random() - 0.5) * 120
    const rotate = Math.random() * 360
    return { left, delay, duration, size, color, drift, rotate, key: i }
  })
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {items.map((p) => (
        <span
          key={p.key}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // Custom properties read by the @keyframes in index.css.
            ['--confetti-drift' as string]: `${p.drift}px`,
            ['--confetti-rotate' as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  )
}

export function GameHeader({
  title,
  rulesKey,
  rules,
}: {
  title: string
  rulesKey: string
  rules: Bilingual
}) {
  const [lang] = useLang()
  const [shareCopied, setShareCopied] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const handleToggleTheme = () => setThemeState(toggleTheme())
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      prompt('Copy this link:', window.location.href)
    }
  }
  return (
    <div className="w-full max-w-md flex items-center justify-between mb-8 gap-2 flex-wrap">
      <Link to="/dashboard" className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm">
        {common.dashboard[lang]}
      </Link>
      <span className="font-semibold">{title}</span>
      <div className="flex items-center gap-2">
        <LangToggle />
        <button
          onClick={handleToggleTheme}
          className="panel px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button onClick={handleShare} className="panel px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
          {shareCopied ? common.linkCopied[lang] : common.share[lang]}
        </button>
        <RulesModal gameKey={rulesKey} title={{ en: `How to play ${title}`, ar: `طريقة لعب ${title}` }}>
          {rules}
        </RulesModal>
      </div>
    </div>
  )
}
