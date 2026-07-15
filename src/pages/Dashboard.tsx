import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Plus, Crown, Grid3x3, Spade, Trash2, Link2, Check } from 'lucide-react'
import { listBoards, createBoard, deleteBoard, createChessGame, createCardGame, getStoredUser, logout, ApiError, type BoardSummary } from '../lib/api'
import './landing.css'

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError(null)
    const trimmed = joinInput.trim()
    if (!trimmed) return

    const match = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    if (!match) {
      setJoinError("That doesn't look like a valid link or ID.")
      return
    }
    const gameId = match[1]
    if (trimmed.includes('/chess/')) navigate({ to: '/chess/$gameId', params: { gameId } })
    else if (trimmed.includes('/games/dominoes/')) navigate({ to: '/games/dominoes/$gameId', params: { gameId } })
    else if (trimmed.includes('/games/koshina/')) navigate({ to: '/games/koshina/$gameId', params: { gameId } })
    else navigate({ to: '/board/$boardId', params: { boardId: gameId } })
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!user) {
      navigate({ to: '/login' })
      return
    }
    listBoards()
      .then(setBoards)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          navigate({ to: '/login' })
        } else {
          setError('Could not load your boards. Is the API running?')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const board = await createBoard('Untitled board')
      navigate({ to: '/board/$boardId', params: { boardId: board.id } })
    } catch {
      setError('Could not create a new board. Is the API running?')
      setCreating(false)
    }
  }

  const [creatingChess, setCreatingChess] = useState(false)

  const handleNewChessGame = async () => {
    setCreatingChess(true)
    try {
      const chessGame = await createChessGame()
      navigate({ to: '/chess/$gameId', params: { gameId: chessGame.id } })
    } catch {
      setError('Could not start a new chess game.')
      setCreatingChess(false)
    }
  }

  const [creatingCardGame, setCreatingCardGame] = useState<string | null>(null)

  const handleNewCardGame = async (type: 'Dominoes' | 'Koshina') => {
    setCreatingCardGame(type)
    try {
      const g = await createCardGame(type)
      if (type === 'Dominoes') navigate({ to: '/games/dominoes/$gameId', params: { gameId: g.id } })
      else navigate({ to: '/games/koshina/$gameId', params: { gameId: g.id } })
    } catch {
      setError(`Could not start a new ${type} game.`)
    } finally {
      setCreatingCardGame(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate({ to: '/' })
  }

  const handleDelete = async (e: React.MouseEvent, boardId: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    try {
      await deleteBoard(boardId)
      setBoards((prev) => prev.filter((b) => b.id !== boardId))
    } catch {
      setError('Could not delete that board.')
    }
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyLink = async (e: React.MouseEvent, boardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/board/${boardId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      prompt('Copy this link:', url)
    }
    setCopiedId(boardId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="ld-page min-h-screen">
      <nav className="ld-nav flex items-center justify-between px-8 py-4">
        <Link to="/" className="ld-wordmark text-lg" style={{ color: 'var(--ld-paper)' }}>
          <span className="ld-wordmark-mark" />
          SLATE
        </Link>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Account"
            className="ld-avatar w-8 h-8 text-sm"
          >
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user?.displayName?.[0]?.toUpperCase() ?? '?')}
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 py-2 z-30"
              style={{ background: 'var(--ld-bg-raised)', border: '1px solid var(--ld-line)', borderRadius: 4 }}
            >
              <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--ld-line)' }}>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ld-paper)' }}>{user?.displayName}</p>
                <p className="text-xs truncate ld-mono" style={{ color: 'var(--ld-paper-dim)' }}>{user?.email}</p>
              </div>
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
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--ld-paper)' }}>Your boards</h1>
        </div>
        <p className="ld-tag mb-6">[ SHEET INDEX ]</p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button onClick={handleCreate} disabled={creating} className="ld-btn-primary disabled:opacity-60">
            {creating ? 'Creating…' : 'New board'} <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={handleNewChessGame} disabled={creatingChess} className="ld-btn-secondary disabled:opacity-60">
            <Crown className="w-3.5 h-3.5" strokeWidth={2} /> {creatingChess ? 'Starting…' : 'Chess'}
          </button>
          <button onClick={() => handleNewCardGame('Dominoes')} disabled={creatingCardGame === 'Dominoes'} className="ld-btn-secondary disabled:opacity-60">
            <Grid3x3 className="w-3.5 h-3.5" strokeWidth={2} /> {creatingCardGame === 'Dominoes' ? 'Starting…' : 'Dominoes'}
          </button>
          <button onClick={() => handleNewCardGame('Koshina')} disabled={creatingCardGame === 'Koshina'} className="ld-btn-secondary disabled:opacity-60">
            <Spade className="w-3.5 h-3.5" strokeWidth={2} /> {creatingCardGame === 'Koshina' ? 'Starting…' : 'كوتشينة'}
          </button>
        </div>

        <form onSubmit={handleJoin} className="flex items-center gap-2 mb-8">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste a board link or ID to join…"
            className="ld-input flex-1"
          />
          <button type="submit" className="ld-btn-secondary text-sm px-4">
            Join
          </button>
        </form>
        {joinError && <p style={{ color: 'var(--ld-danger)' }} className="text-sm -mt-6 mb-6">{joinError}</p>}

        {error && (
          <div className="ld-card p-4 mb-6 text-sm" style={{ borderColor: 'var(--ld-danger)', color: 'var(--ld-danger)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="ld-card p-12 text-center" style={{ color: 'var(--ld-paper-dim)' }}>Loading…</div>
        ) : boards.length === 0 ? (
          <div className="ld-card p-12 text-center" style={{ color: 'var(--ld-paper-dim)' }}>
            No boards yet — create your first one to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {boards.map((b) => (
              <Link
                key={b.id}
                to="/board/$boardId"
                params={{ boardId: b.id }}
                className="ld-card p-5 block group relative"
              >
                <button
                  onClick={(e) => handleDelete(e, b.id, b.title)}
                  title="Delete board"
                  className="absolute top-3 right-3 w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: 'var(--ld-paper-dim)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                <button
                  onClick={(e) => handleCopyLink(e, b.id)}
                  title="Copy board link"
                  className="absolute top-3 right-12 w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: copiedId === b.id ? 'var(--ld-accent-3)' : 'var(--ld-paper-dim)' }}
                >
                  {copiedId === b.id ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <Link2 className="w-3.5 h-3.5" strokeWidth={2} />}
                </button>
                <div
                  className="h-28 rounded mb-4"
                  style={{
                    background: 'var(--ld-bg-deep)',
                    backgroundImage: 'linear-gradient(var(--ld-line) 1px, transparent 1px), linear-gradient(90deg, var(--ld-line) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--ld-paper)' }}>{b.title}</h3>
                <p className="ld-mono text-xs mt-1" style={{ color: 'var(--ld-paper-dim)' }}>
                  Active {timeAgo(b.lastActiveAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
