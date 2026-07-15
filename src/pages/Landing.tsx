import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  MousePointer2, Maximize, Download, Crown, Grid3x3, Spade,
  ChevronDown, ArrowRight, Plus,
} from 'lucide-react'
import { getStoredUser, logout } from '../lib/api'
import './landing.css'

function BlueprintCanvas() {
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
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    resize()

    const gridColor = 'rgba(140, 179, 219, 0.16)'
    const strokeColor = '#EDF4FC'
    const cursors = [
      { x: 70, y: 90, vx: 0.22, vy: 0.14, color: '#FF6B35', name: 'Sara' },
      { x: 260, y: 200, vx: -0.16, vy: 0.2, color: '#7DE0C7', name: 'Omar' },
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

      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 28) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const progress = Math.floor((t / 4) % (strokePath.length + 40))
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash([1, 0])
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

        ctx.font = '500 11px "IBM Plex Mono", monospace'
        const textW = ctx.measureText(c.name).width
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(c.x + 10, c.y - 8, textW + 12, 18, 2)
        else ctx.rect(c.x + 10, c.y - 8, textW + 12, 18)
        ctx.fillStyle = c.color
        ctx.fill()
        ctx.fillStyle = '#0A2039'
        ctx.fillText(c.name, c.x + 16, c.y + 4)
      })

      t += 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative">
      <span className="ld-crop ld-crop-tl" />
      <span className="ld-crop ld-crop-tr" />
      <span className="ld-crop ld-crop-bl" />
      <span className="ld-crop ld-crop-br" />
      <canvas
        ref={canvasRef}
        className="w-full h-[360px]"
        style={{ background: '#0A2039', border: '1px solid var(--ld-line)' }}
      />
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="ld-mono text-[11px]" style={{ color: 'var(--ld-paper-dim)' }}>FIG. 01 — LIVE BOARD</span>
        <span className="ld-mono text-[11px] flex items-center gap-1.5" style={{ color: 'var(--ld-accent-3)' }}>
          <span className="w-1.5 h-1.5 rounded-full ld-blink" style={{ background: 'var(--ld-accent-3)' }} />
          2 EDITING NOW
        </span>
      </div>
    </div>
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

function SectionRule({ label }: { label: string }) {
  return (
    <div className="ld-rule mx-8">
      <span className="ld-rule-tag ld-mono">{label}</span>
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
      className="ld-card p-6"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(14px)',
        transitionDelay: `${delay}ms`,
        transitionProperty: 'opacity, transform, border-color',
        transitionDuration: '0.6s, 0.6s, 0.25s',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="ld-icon-ring mb-4">
        {children}
      </div>
      <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--ld-paper)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ld-paper-dim)' }}>{desc}</p>
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

function Faq({ index, q, a }: { index: number; q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ld-faq-row">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 py-4 text-left"
      >
        <span className="ld-faq-index ld-mono">Q{index}</span>
        <span className="font-medium text-sm flex-1" style={{ color: 'var(--ld-paper)' }}>{q}</span>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-300"
          style={{ color: 'var(--ld-paper-dim)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="pb-4 pl-[46px] text-sm leading-relaxed" style={{ color: 'var(--ld-paper-dim)' }}>{a}</p>
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
    <div className="ld-page min-h-screen flex flex-col">
      <nav className="ld-nav flex items-center justify-between px-8 py-4">
        <Link to="/" className="ld-wordmark text-lg" style={{ color: 'var(--ld-paper)' }}>
          <span className="ld-wordmark-mark" />
          SLATE
        </Link>
        <div className="flex items-center gap-7">
          <a href="#features" className="ld-nav-link">Features</a>
          <a href="#games" className="ld-nav-link">Games</a>
          <a href="#how-it-works" className="ld-nav-link">How it works</a>
          <a href="#faq" className="ld-nav-link">FAQ</a>
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="ld-avatar w-8 h-8 text-sm"
              >
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.displayName?.[0]?.toUpperCase() ?? '?')}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 py-2 z-30"
                  style={{ background: 'var(--ld-bg-raised)', border: '1px solid var(--ld-line)', borderRadius: 4 }}
                >
                  <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--ld-line)' }}>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ld-paper)' }}>{user.displayName}</p>
                    <p className="text-xs truncate ld-mono" style={{ color: 'var(--ld-paper-dim)' }}>{user.email}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--ld-paper)' }}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: 'var(--ld-paper)' }}
                  >
                    Profile settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm hover:opacity-80"
                    style={{ color: '#FF8A6E' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="ld-nav-link">Sign In</Link>
              <Link to="/register" className="ld-btn-primary">
                Create a board <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="relative">
        <span className="ld-crop ld-crop-tl" />
        <span className="ld-crop ld-crop-tr" />
        <div className="relative grid md:grid-cols-2 gap-14 items-center px-8 py-28 max-w-6xl mx-auto">
          <div className="ld-fade-up">
            <span className="ld-tag mb-6">[ REAL-TIME COLLABORATION ]</span>
            <h1 className="text-5xl md:text-6xl font-semibold leading-[1.08] mt-4 mb-6" style={{ color: 'var(--ld-paper)' }}>
              A clean slate,<br />drawn together.
            </h1>
            <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--ld-paper-dim)' }}>
              Start a board, share the link, and sketch out your next idea with your team — live.
            </p>
            <div className="flex items-center gap-6 flex-wrap">
              <Link to="/register" className="ld-btn-primary">
                Create a board <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </Link>
              <a href="#how-it-works" className="ld-btn-secondary">
                See how it works
              </a>
            </div>
          </div>
          <div className="ld-fade-up" style={{ animationDelay: '0.12s' }}>
            <BlueprintCanvas />
          </div>
        </div>
      </section>

      <section id="features">
        <SectionRule label="§ 01 — FEATURES" />
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-10 text-center" style={{ color: 'var(--ld-paper)' }}>Built for thinking together</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard title="Live cursors" desc="See everyone's cursor and name moving in real time, like looking over their shoulder." delay={0}>
              <MousePointer2 className="w-5 h-5" style={{ color: 'var(--ld-accent)' }} strokeWidth={2} />
            </FeatureCard>
            <FeatureCard title="Infinite canvas" desc="Pan and zoom freely — your ideas are never boxed in." delay={100}>
              <Maximize className="w-5 h-5" style={{ color: 'var(--ld-accent-3)' }} strokeWidth={2} />
            </FeatureCard>
            <FeatureCard title="Export anywhere" desc="PNG, PDF, or a clean text list of every sticky note." delay={200}>
              <Download className="w-5 h-5" style={{ color: 'var(--ld-accent-2)' }} strokeWidth={2} />
            </FeatureCard>
          </div>
        </div>
      </section>

      <section id="games">
        <SectionRule label="§ 02 — GAMES" />
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--ld-paper)' }}>Need a break from the whiteboard?</h2>
              <p className="max-w-lg mx-auto" style={{ color: 'var(--ld-paper-dim)' }}>
                Every board comes with a lobby of two-player games — same link-sharing, same live sync.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {games.map((g, i) => (
              <Reveal key={g.title} delay={i * 100}>
                <div className="ld-card p-6 h-full">
                  <div className="ld-icon-ring mb-4">
                    <g.icon className="w-5 h-5" style={{ color: 'var(--ld-accent)' }} strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--ld-paper)' }}>{g.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ld-paper-dim)' }}>{g.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works">
        <SectionRule label="§ 03 — HOW IT WORKS" />
        <div className="px-8 py-24 max-w-6xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-12 text-center" style={{ color: 'var(--ld-paper)' }}>How it works</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="relative">
                  <span className="ld-mono text-sm block mb-3" style={{ color: 'var(--ld-accent-3)' }}>
                    {s.n}
                  </span>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--ld-paper)' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ld-paper-dim)' }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq">
        <SectionRule label="§ 04 — FAQ" />
        <div className="px-8 py-24 max-w-3xl mx-auto w-full">
          <Reveal>
            <h2 className="text-2xl font-semibold mb-10 text-center" style={{ color: 'var(--ld-paper)' }}>Questions, answered</h2>
          </Reveal>
          <div className="flex flex-col">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <Faq index={i + 1} q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <section
          className="relative mx-8 mb-24 mt-8 max-w-6xl md:mx-auto p-14 text-center overflow-hidden"
          style={{ background: 'var(--ld-bg-raised)', border: '1px solid var(--ld-line)', borderRadius: 6 }}
        >
          <span className="ld-crop ld-crop-tl" />
          <span className="ld-crop ld-crop-br" />
          <div className="ld-stamp hidden md:flex" style={{ top: 20, right: 40 }}>
            SLATE<br />LIVE SYNC
          </div>
          <h2 className="text-3xl font-semibold mb-6" style={{ color: 'var(--ld-paper)' }}>Ready to start a board?</h2>
          <Link to="/register" className="ld-btn-primary inline-flex">
            Start for free <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </section>
      </Reveal>

      <footer className="ld-titleblock mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch gap-4 md:gap-0 px-8 py-6">
          <div className="ld-wordmark text-sm pr-6" style={{ color: 'var(--ld-paper)' }}>
            <span className="ld-wordmark-mark" style={{ width: 7, height: 7 }} />
            SLATE
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 flex-1 md:pl-6" style={{ borderLeft: '1px solid var(--ld-line)' }}>
            <span className="ld-titleblock-cell" style={{ borderLeft: 'none' }}>DRAWN — SLATE TEAM</span>
            <span className="ld-titleblock-cell">SCALE — 1:1</span>
            <span className="ld-titleblock-cell">REV — 2026.07</span>
          </div>
          <div className="flex items-center gap-6 md:pl-6" style={{ borderLeft: '1px solid var(--ld-line)' }}>
            <a href="#features" className="ld-nav-link">Features</a>
            <a href="#how-it-works" className="ld-nav-link">How it works</a>
            <Link to="/login" className="ld-nav-link">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
