import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  MousePointer2, Maximize, Download, Crown, Grid3x3, Spade,
  ChevronDown,
} from 'lucide-react'
import { getStoredUser, logout } from '../lib/api'

// Reads a resolved CSS custom property off <html>, so canvas drawing (which
// can't use var(...) directly) still follows the light/dark theme toggle.
function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const accent = cssVar('--color-accent', '#1E9370')
    const accent2 = cssVar('--color-accent-2', '#4A63D6')
    const dotColor = cssVar('--color-border-hover', 'rgba(28,27,24,0.15)')

    const cursors = [
      { x: 70, y: 90, vx: 0.22, vy: 0.14, color: accent, name: 'Sara' },
      { x: 260, y: 200, vx: -0.16, vy: 0.2, color: accent2, name: 'Omar' },
    ]

    let t = 0
    let raf: number
    const strokePath: [number, number][] = Array.from({ length: 50 }, (_, i) => [
      50 + i * 4.2,
      220 + Math.sin(i / 6) * 50,
    ])

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      ctx.fillStyle = dotColor
      for (let x = 0; x < w; x += 24) {
        for (let y = 0; y < h; y += 24) {
          ctx.fillRect(x, y, 1, 1)
        }
      }

      const progress = Math.floor((t / 4) % (strokePath.length + 40))
      ctx.strokeStyle = accent
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      strokePath.slice(0, Math.min(progress, strokePath.length)).forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      cursors.forEach((c) => {
        c.x += c.vx
        c.y += c.vy
        if (c.x < 20 || c.x > w - 90) c.vx *= -1
        if (c.y < 20 || c.y > h - 40) c.vy *= -1

        ctx.fillStyle = c.color
        ctx.beginPath()
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2)
        ctx.fill()

        ctx.font = '500 11px Inter, sans-serif'
        const textW = ctx.measureText(c.name).width
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(c.x + 10, c.y - 8, textW + 12, 18, 9)
        else ctx.rect(c.x + 10, c.y - 8, textW + 12, 18)
        ctx.fillStyle = c.color
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(c.name, c.x + 16, c.y + 4)
      })

      t += 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[360px] rounded-xl border border-[var(--color-border)]"
      style={{ background: 'var(--color-surface)' }}
    />
  )
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, inView }
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="transition-all duration-700"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(16px)',
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  )
}

function FeatureCard({
  title,
  desc,
  delay,
  children,
}: {
  title: string
  desc: string
  delay: number
  children: React.ReactNode
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="panel p-6 transition-all duration-300 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(14px)',
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="w-11 h-11 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center mb-4 relative overflow-hidden">
        {children}
      </div>
      <h3 className="font-semibold text-base mb-2">{title}</h3>
      <p className="text-[var(--color-text-dim)] text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

const steps = [
  { n: '01', title: 'Create a board', desc: 'Spin up a fresh canvas in one click — no setup required.' },
  { n: '02', title: 'Share the link', desc: 'Invite your team with a link. No downloads, no waiting on invites.' },
  { n: '03', title: 'Draw together, live', desc: 'Everyone sketches, sticky-notes, and edits on the same board at once.' },
]

const games = [
  { title: 'Chess', desc: 'A full live match, move by move, with your opponent\u2019s clock ticking on the same board.', icon: Crown },
  { title: 'Dominoes', desc: 'Classic 7-tile dominoes on a felt table — drag a tile to either end of the chain.', icon: Grid3x3 },
  { title: 'Koshina', desc: 'The card game from home, playable with a friend anywhere — just share the link.', icon: Spade },
]

const faqs = [
  { q: 'Do I need to install anything?', a: 'No. Slate runs entirely in the browser — create a board or start a game and share the link, that\u2019s it.' },
  { q: 'How many people can join one board?', a: 'As many as you like. Everyone who opens the link joins as an editor and shows up with a live cursor.' },
  { q: 'Can someone just view without editing?', a: 'Yes — the board owner can switch any member to view-only from the members list at any time.' },
  { q: 'Is my board saved automatically?', a: 'Yes. Your board is saved continuously as you work, so you can close the tab and pick up right where you left off.' },
]

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-medium text-sm">{q}</span>
        <ChevronDown
          className="w-4 h-4 shrink-0 text-[var(--color-text-dim)] transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm text-[var(--color-text-dim)] leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-body flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)] relative z-10">
        <Link to="/" className="text-lg font-semibold tracking-tight">Slate</Link>
        <div className="flex items-center gap-7 text-sm text-[var(--color-text-dim)]">
          <a href="#features" className="nav-link">Features</a>
          <a href="#games" className="nav-link">Games</a>
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#faq" className="nav-link">FAQ</a>
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[#082A20] text-sm font-semibold"
              >
                {user.displayName?.[0]?.toUpperCase() ?? '?'}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 panel py-2 z-30">
                  <div className="px-4 py-2 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <p className="text-xs text-[var(--color-text-dim)] truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-elevated)]"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-elevated)]"
                  >
                    Profile settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-surface-elevated)]"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-link">Sign In</Link>
              <Link to="/register" className="btn-primary text-sm">
                Create a board
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div
          className="orb-a absolute -left-24 top-10 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'var(--color-accent-soft)' }}
        />
        <div
          className="orb-b absolute right-0 top-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(74,99,214,0.10)' }}
        />
        <div className="relative grid md:grid-cols-2 gap-14 items-center px-8 py-28 max-w-6xl mx-auto">
          <div className="fade-up">
            <span className="inline-block text-xs font-mono text-[var(--color-accent)] bg-[var(--color-accent-soft)] rounded-full px-3 py-1 mb-6">
              Real-time collaboration
            </span>
            <h1 className="text-5xl md:text-6xl font-semibold leading-[1.1] mb-6 tracking-tight">
              A clean slate,<br />drawn together.
            </h1>
            <p className="text-[var(--color-text-dim)] text-lg mb-8 max-w-md">
              Start a board, share the link, and sketch out your next idea with your team — live.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/register" className="btn-primary">
                Create a board
              </Link>
              <a href="#how-it-works" className="btn-secondary">
                See how it works
              </a>
            </div>
          </div>
          <div className="fade-up" style={{ animationDelay: '0.1s' }}>
            <AmbientCanvas />
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-10 text-center">Built for thinking together</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard title="Live cursors" desc="See everyone's cursor and name moving in real time, like looking over their shoulder." delay={0}>
              <MousePointer2 className="w-5 h-5 text-[var(--color-accent)] icon-orbit" strokeWidth={2} />
            </FeatureCard>
            <FeatureCard title="Infinite canvas" desc="Pan and zoom freely — your ideas are never boxed in." delay={100}>
              <Maximize className="w-5 h-5 text-[var(--color-accent)] icon-pulse" strokeWidth={2} />
            </FeatureCard>
            <FeatureCard title="Export anywhere" desc="PNG, PDF, or a clean text list of every sticky note." delay={200}>
              <Download className="w-5 h-5 text-[var(--color-accent)] icon-bounce" strokeWidth={2} />
            </FeatureCard>
          </div>
        </div>
      </section>

      <section id="games" className="border-t border-[var(--color-border)]">
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-semibold mb-3">Need a break from the whiteboard?</h2>
              <p className="text-[var(--color-text-dim)] max-w-lg mx-auto">
                Every board comes with a lobby of two-player games — same link-sharing, same live sync.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {games.map((g, i) => (
              <Reveal key={g.title} delay={i * 100}>
                <div className="panel p-6 h-full transition-all duration-300 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5">
                  <div className="w-11 h-11 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center mb-4">
                    <g.icon className="w-5 h-5 text-[var(--color-accent)]" strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{g.title}</h3>
                  <p className="text-[var(--color-text-dim)] text-sm leading-relaxed">{g.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-[var(--color-border)]">
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-12 text-center">How it works</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="relative">
                  <span className="text-4xl font-semibold text-[var(--color-accent)] opacity-30 block mb-3">
                    {s.n}
                  </span>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-[var(--color-text-dim)] text-sm leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="px-8 py-24 max-w-3xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-10 text-center">Questions, answered</h2>
          </Reveal>
          <div className="flex flex-col gap-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <Faq q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <section className="mx-8 mb-24 mt-8 max-w-6xl md:mx-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-14 text-center">
          <h2 className="text-3xl font-semibold mb-6">Ready to start a board?</h2>
          <Link to="/register" className="btn-primary inline-block">
            Start for free
          </Link>
        </section>
      </Reveal>

      <footer className="border-t border-[var(--color-border)] px-8 py-8 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold">Slate</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-dim)]">
            <a href="#features" className="hover:text-[var(--color-text)] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[var(--color-text)] transition-colors">How it works</a>
            <Link to="/login" className="hover:text-[var(--color-text)] transition-colors">Sign in</Link>
          </div>
          <span className="text-xs text-[var(--color-text-dim)]">© 2026 Slate</span>
        </div>
      </footer>
    </div>
  )
}
