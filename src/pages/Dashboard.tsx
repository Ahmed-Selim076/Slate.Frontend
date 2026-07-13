import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { listBoards, createBoard, deleteBoard, createChessGame, createCardGame, getStoredUser, logout, ApiError, type BoardSummary } from '../lib/api'

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
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)]">
        <Link to="/" className="text-lg font-semibold">Slate</Link>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Account"
            className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[#082A20] text-sm font-semibold"
          >
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 panel py-2 z-30">
              <div className="px-4 py-2 border-b border-[var(--color-border)]">
                <p className="text-sm font-medium truncate">{user?.displayName}</p>
                <p className="text-xs text-[var(--color-text-dim)] truncate">{user?.email}</p>
              </div>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)]"
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
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-semibold">Your boards</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button onClick={handleCreate} disabled={creating} className="btn-primary disabled:opacity-60">
            {creating ? 'Creating…' : '+ New board'}
          </button>
          <button onClick={handleNewChessGame} disabled={creatingChess} className="btn-secondary disabled:opacity-60">
            {creatingChess ? 'Starting…' : '♞ Chess'}
          </button>
          <button onClick={() => handleNewCardGame('Dominoes')} disabled={creatingCardGame === 'Dominoes'} className="btn-secondary disabled:opacity-60">
            {creatingCardGame === 'Dominoes' ? 'Starting…' : '🁣 Dominoes'}
          </button>
          <button onClick={() => handleNewCardGame('Koshina')} disabled={creatingCardGame === 'Koshina'} className="btn-secondary disabled:opacity-60">
            {creatingCardGame === 'Koshina' ? 'Starting…' : '🃏 كوتشينة'}
          </button>
        </div>

        <form onSubmit={handleJoin} className="flex items-center gap-2 mb-8">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste a board link or ID to join…"
            className="flex-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <button type="submit" className="btn-secondary text-sm px-4">
            Join
          </button>
        </form>
        {joinError && <p className="text-[var(--color-danger)] text-sm -mt-6 mb-6">{joinError}</p>}

        {error && (
          <div className="panel p-4 mb-6 border-[var(--color-danger)] text-[var(--color-danger)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="panel p-12 text-center text-[var(--color-text-dim)]">Loading…</div>
        ) : boards.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-text-dim)]">
            No boards yet — create your first one to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {boards.map((b) => (
              <Link
                key={b.id}
                to="/board/$boardId"
                params={{ boardId: b.id }}
                className="panel p-5 block group hover:border-[var(--color-border-hover)] transition-colors relative"
              >
                <button
                  onClick={(e) => handleDelete(e, b.id, b.title)}
                  title="Delete board"
                  className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-elevated)] transition-all"
                >
                  🗑
                </button>
                <button
                  onClick={(e) => handleCopyLink(e, b.id)}
                  title="Copy board link"
                  className="absolute top-3 right-12 w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-elevated)] transition-all text-xs"
                >
                  {copiedId === b.id ? '✓' : '🔗'}
                </button>
                <div className="h-28 rounded-lg mb-4 dot-grid-bg bg-[var(--color-surface-elevated)]" />
                <h3 className="font-semibold text-sm">{b.title}</h3>
                <p className="text-xs text-[var(--color-text-dim)] mt-1">
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
