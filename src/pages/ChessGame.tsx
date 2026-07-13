import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Chess, type Square } from 'chess.js'
import {
  getChessGame,
  makeChessMove,
  resignChessGame,
  getStoredUser,
  ApiError,
  type ChessGame as ChessGameData,
} from '../lib/api'
import { createChessConnection } from '../lib/signalr'
import type * as signalR from '@microsoft/signalr'
import { RulesModal, LangToggle, type Bilingual } from '../lib/gameUi'
import { playMoveSound, playCaptureSound, playCheckSound, playKingTrembleSound, unlockAudio } from '../lib/sound'
import { getTheme, toggleTheme, type Theme } from '../lib/theme'
import { useLang, common, chessText as t } from '../lib/i18n'

const PIECE_GLYPHS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}

// Starting material per side (kings are never captured, so excluded).
const STARTING_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }

/** Locates a given color's king on the board, e.g. to highlight/shake it when in check. */
function findKingSquare(board: ReturnType<Chess['board']>, color: 'w' | 'b'): Square | null {
  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const cell = board[ri][ci]
      if (cell && cell.type === 'k' && cell.color === color) return `${FILES[ci]}${RANKS[ri]}` as Square
    }
  }
  return null
}

// Diffs the current board against a full starting set to figure out which
// pieces are missing — i.e. what's been captured. Same simple approach
// chess.com/lichess-style UIs use; a promoted pawn can very slightly throw
// off the pawn/queen split here, but the total captured count is still
// right and that's what actually matters for this display.
function getCapturedPieces(board: ReturnType<Chess['board']>) {
  const onBoard: Record<'w' | 'b', Record<string, number>> = { w: {}, b: {} }
  for (const row of board) {
    for (const cell of row) {
      if (!cell || cell.type === 'k') continue
      onBoard[cell.color][cell.type] = (onBoard[cell.color][cell.type] || 0) + 1
    }
  }
  const captured: Record<'w' | 'b', string[]> = { w: [], b: [] }
  for (const color of ['w', 'b'] as const) {
    for (const type of ['q', 'r', 'b', 'n', 'p']) {
      const missing = STARTING_COUNTS[type] - (onBoard[color][type] || 0)
      for (let i = 0; i < Math.max(0, missing); i++) captured[color].push(type)
    }
  }
  return captured
}

function CapturedRow({ pieces, color }: { pieces: string[]; color: 'w' | 'b' }) {
  if (pieces.length === 0) return <span className="text-[var(--color-text-dim)] text-xs">—</span>
  return (
    <span className="flex gap-0.5 flex-wrap" style={{ color: color === 'w' ? 'var(--color-text)' : 'var(--color-accent)' }}>
      {pieces.map((type, i) => (
        <span key={i} className="text-base leading-none">
          {PIECE_GLYPHS[`${color}${type}`]}
        </span>
      ))}
    </span>
  )
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

// How long each capture's impact effect stays on screen, scaled with the
// captured piece's value — a pawn barely flickers, a queen gets the full show.
const CAPTURE_FX_DURATION: Record<string, number> = { p: 320, n: 500, b: 500, r: 700, q: 950 }
// Only the heaviest captures (rook, queen) also rattle the board a bit.
const CAPTURE_FX_SHAKE: Record<string, number> = { r: 350, q: 420 }

type CaptureFx = { id: number; square: Square; type: 'p' | 'n' | 'b' | 'r' | 'q' }

/** Pulls the destination square out of a SAN string, e.g. "Rxe8+" -> "e8", "exd6" -> "d6". */
function sanToSquare(san: string): Square | null {
  const clean = san.replace(/[+#]/g, '').replace(/=[QRBN]/, '')
  const match = clean.match(/([a-h][1-8])$/)
  return match ? (match[1] as Square) : null
}

const chessRules: Bilingual = {
  en: (
    <>
      <p>Standard chess rules, enforced automatically — the app won't let you make an illegal move.</p>
      <p>Whoever created the game plays White and moves first. The link joins the second person as Black.</p>
      <p>Tap a piece to see its legal moves highlighted, then tap a highlighted square to move there.</p>
      <p>Game ends on checkmate, stalemate, draw, or resignation.</p>
    </>
  ),
  ar: (
    <>
      <p>قواعد الشطرنج الرسمية، بتتطبق أوتوماتيك — التطبيق مش هيسيبك تعمل حركة غلط.</p>
      <p>اللي عمل اللعبة بيلعب بالأبيض ويبدأ هو الأول. اللينك بيضم الشخص التاني كأسود.</p>
      <p>دوس على أي قطعة عشان تشوف الحركات المسموحة ليها متلونة، وبعدين دوس على المربع المتلون عشان تتحرك ليه.</p>
      <p>اللعبة بتخلص بكش ملك، أو تعادل بالحصار، أو تعادل عادي، أو استسلام.</p>
    </>
  ),
}

export default function ChessGamePage() {
  const { gameId } = useParams({ from: '/chess/$gameId' })
  const navigate = useNavigate()
  const user = getStoredUser()
  const [lang] = useLang()

  const [game, setGame] = useState<ChessGameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chessRef = useRef(new Chess())
  const [, forceRender] = useState(0)

  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [shareCopied, setShareCopied] = useState(false)

  const connectionRef = useRef<signalR.HubConnection | null>(null)

  const [theme, setThemeState] = useState<Theme>(getTheme())
  const handleToggleTheme = () => setThemeState(toggleTheme())

  // Chess table skin — independent of the site's light/dark theme.
  const [boardSkin, setBoardSkin] = useState<'wood' | 'bw'>(() => {
    if (typeof window === 'undefined') return 'wood'
    return localStorage.getItem('chess-board-skin') === 'bw' ? 'bw' : 'wood'
  })
  const handleToggleBoardSkin = () => {
    setBoardSkin((prev) => {
      const next = prev === 'wood' ? 'bw' : 'wood'
      localStorage.setItem('chess-board-skin', next)
      return next
    })
  }

  const [captureFx, setCaptureFx] = useState<CaptureFx | null>(null)
  const [boardShake, setBoardShake] = useState(false)
  const fxIdRef = useRef(0)

  const triggerCaptureFx = useCallback((square: Square, type: string) => {
    if (!(type in CAPTURE_FX_DURATION)) return
    const id = ++fxIdRef.current
    setCaptureFx({ id, square, type: type as CaptureFx['type'] })
    setTimeout(() => {
      setCaptureFx((prev) => (prev?.id === id ? null : prev))
    }, CAPTURE_FX_DURATION[type])

    const shakeDuration = CAPTURE_FX_SHAKE[type]
    if (shakeDuration) {
      setBoardShake(true)
      setTimeout(() => setBoardShake(false), shakeDuration)
    }
  }, [])

  const [kingShake, setKingShake] = useState<{ id: number; square: Square } | null>(null)
  const kingShakeIdRef = useRef(0)

  const triggerKingShake = useCallback((square: Square) => {
    const id = ++kingShakeIdRef.current
    setKingShake({ id, square })
    playKingTrembleSound()
    setTimeout(() => {
      setKingShake((prev) => (prev?.id === id ? null : prev))
    }, 700)
  }, [])

  // Unlock the browser's audio autoplay restriction on the very first
  // interaction with the page, so a sound for the opponent's move — which
  // arrives over the network, not from a click — is allowed to play even
  // if this is the very first thing that happens on this tab.
  useEffect(() => {
    const unlock = () => unlockAudio()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      navigate({ to: '/login' })
      return
    }
    getChessGame(gameId)
      .then((g) => {
        setGame(g)
        chessRef.current = new Chess(g.fen)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate({ to: '/login' })
        else setError('Could not load this game.')
      })
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => {
    let cancelled = false
    const connection = createChessConnection()
    connectionRef.current = connection

    connection.on('ReceiveMove', (payload: { fen: string; san: string; status: string; winner: string }) => {
      // Figure out what (if anything) was captured before we discard the
      // pre-move position — the SAN alone doesn't say which piece was taken.
      if (payload.san.includes('x')) {
        const destSquare = sanToSquare(payload.san)
        const capturedPiece = destSquare ? chessRef.current.get(destSquare) : null
        if (capturedPiece && destSquare) triggerCaptureFx(destSquare, capturedPiece.type)
      }
      chessRef.current = new Chess(payload.fen)
      setGame((prev) =>
        prev
          ? {
              ...prev,
              fen: payload.fen,
              moveHistory: prev.moveHistory ? `${prev.moveHistory} ${payload.san}` : payload.san,
              status: payload.status as ChessGameData['status'],
              winner: payload.winner as ChessGameData['winner'],
            }
          : prev,
      )
      setSelected(null)
      setLegalTargets([])
      forceRender((n) => n + 1)

      if (payload.san.includes('#') || payload.san.includes('+')) {
        playCheckSound()
        const kingSq = findKingSquare(chessRef.current.board(), chessRef.current.turn())
        if (kingSq) triggerKingShake(kingSq)
      }
      else if (payload.san.includes('x')) playCaptureSound()
      else playMoveSound()
    })

    connection.on('PlayerJoined', (payload: { blackPlayerId: string; blackPlayerName: string; status: string }) => {
      setGame((prev) =>
        prev
          ? {
              ...prev,
              blackPlayerId: payload.blackPlayerId,
              blackPlayerName: payload.blackPlayerName,
              status: payload.status as ChessGameData['status'],
            }
          : prev,
      )
    })

    connection.on('ReceiveResign', (payload: { winner: string }) => {
      setGame((prev) => (prev ? { ...prev, status: 'Resigned', winner: payload.winner as ChessGameData['winner'] } : prev))
    })

    // React StrictMode's dev-only double-invoke (mount → cleanup → mount)
    // runs synchronously in one tick. Deferring the real connection.start()
    // by a tick means the cleanup below fires and clears this timer before
    // the phantom first attempt ever calls .start() — so there's no
    // negotiation to abort, and no "connection was stopped during
    // negotiation" log at all (that log comes from inside the SignalR
    // client itself, so catching the rejected promise can't prevent it —
    // only never starting the phantom attempt can).
    const startTimer = setTimeout(() => {
      if (cancelled) return
      connection
        .start()
        .then(() => {
          if (!cancelled) connection.invoke('JoinGame', gameId)
        })
        .catch((err) => {
          if (!cancelled) console.error('Chess connection failed to start:', err)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      connection.invoke('LeaveGame', gameId).catch(() => {})
      connection.stop()
      connectionRef.current = null
    }
  }, [gameId])

  const myColorChar = game?.myColor === 'White' ? 'w' : game?.myColor === 'Black' ? 'b' : null
  const isMyTurn = game?.status === 'InProgress' && myColorChar === chessRef.current.turn()
  const gameOver = game && ['Checkmate', 'Stalemate', 'Draw', 'Resigned'].includes(game.status)

  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null)

  const commitMove = useCallback(
    (from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n') => {
      const chess = chessRef.current
      let move
      try {
        move = chess.move({ from, to, promotion })
      } catch {
        move = null
      }
      if (move) {
        const fen = chess.fen()
        let status: ChessGameData['status'] = 'InProgress'
        let winner: ChessGameData['winner'] = 'None'
        if (chess.isCheckmate()) {
          status = 'Checkmate'
          winner = chess.turn() === 'w' ? 'Black' : 'White' // side to move just got mated
        } else if (chess.isStalemate()) {
          status = 'Stalemate'
        } else if (chess.isDraw()) {
          status = 'Draw'
        }

        setGame((prev) =>
          prev
            ? {
                ...prev,
                fen,
                moveHistory: prev.moveHistory ? `${prev.moveHistory} ${move.san}` : move.san,
                status,
                winner,
              }
            : prev,
        )
        makeChessMove(gameId, fen, move.san, status, winner).catch(() => {})
        connectionRef.current?.invoke('SendMove', gameId, fen, move.san, status, winner).catch(() => {})

        if (move.captured) triggerCaptureFx(to, move.captured)

        if (status === 'Checkmate' || chess.inCheck()) {
          playCheckSound()
          const kingSq = findKingSquare(chess.board(), chess.turn())
          if (kingSq) triggerKingShake(kingSq)
        }
        else if (move.captured) playCaptureSound()
        else playMoveSound()
      }
      setSelected(null)
      setLegalTargets([])
      forceRender((n) => n + 1)
    },
    [gameId, triggerCaptureFx, triggerKingShake],
  )

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!game || gameOver || !isMyTurn) return
      const chess = chessRef.current

      if (selected) {
        if (legalTargets.includes(square)) {
          const movingPiece = chess.get(selected)
          const isPromotion = movingPiece?.type === 'p' && (square[1] === '8' || square[1] === '1')
          if (isPromotion) {
            // Ask which piece to promote to instead of always defaulting to
            // a queen — the picker below finishes the move once they choose.
            setPendingPromotion({ from: selected, to: square })
            setSelected(null)
            setLegalTargets([])
            return
          }
          commitMove(selected, square, 'q')
          return
        }
      }

      const piece = chess.get(square)
      if (piece && piece.color === myColorChar) {
        setSelected(square)
        setLegalTargets(chess.moves({ square, verbose: true }).map((m) => m.to as Square))
      } else {
        setSelected(null)
        setLegalTargets([])
      }
    },
    [game, gameOver, isMyTurn, selected, legalTargets, myColorChar, commitMove],
  )

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      prompt('Copy this link:', window.location.href)
    }
  }

  const handleResign = async () => {
    if (!confirm('Resign this game?')) return
    try {
      await resignChessGame(gameId)
      const winner = game?.myColor === 'White' ? 'Black' : 'White'
      setGame((prev) => (prev ? { ...prev, status: 'Resigned', winner } : prev))
      connectionRef.current?.invoke('SendResign', gameId, winner).catch(() => {})
    } catch {
      setError('Could not resign.')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-dim)]">{common.loading[lang]}</div>
  }
  if (error || !game) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-danger)]">
        {error || common.gameNotFound[lang]}
      </div>
    )
  }

  const board = chessRef.current.board()
  const captured = getCapturedPieces(board)
  const inCheckKingSquare = chessRef.current.inCheck() ? findKingSquare(board, chessRef.current.turn()) : null

  const statusLabel = () => {
    if (game.status === 'WaitingForOpponent') return common.waitingForOpponent[lang]
    if (game.status === 'Checkmate') return t.checkmate(game.winner ?? '')[lang]
    if (game.status === 'Stalemate') return t.stalemate[lang]
    if (game.status === 'Draw') return t.draw[lang]
    if (game.status === 'Resigned') return t.resignedWin(game.winner ?? '')[lang]
    return isMyTurn ? t.yourMove[lang] : t.waitingFor((chessRef.current.turn() === 'w' ? game.whitePlayerName : game.blackPlayerName) ?? '…')[lang]
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-xl flex items-center justify-between mb-6 gap-2 flex-wrap">
        <Link to="/dashboard" className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm">
          {common.dashboard[lang]}
        </Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            onClick={handleToggleTheme}
            className="panel px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={handleToggleBoardSkin}
            className="panel px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            title={boardSkin === 'wood' ? 'التبديل لترابيزة أبيض/أسود' : 'التبديل لترابيزة خشب'}
          >
            {boardSkin === 'wood' ? '♟️ خشب' : '♟️ أبيض/أسود'}
          </button>
          <button onClick={handleShare} className="panel px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            {shareCopied ? common.linkCopied[lang] : common.share[lang]}
          </button>
          <RulesModal gameKey="chess" title={{ en: 'How to play Chess', ar: 'طريقة لعب الشطرنج' }}>
            {chessRules}
          </RulesModal>
          {!gameOver && game.myColor !== 'Spectator' && game.status === 'InProgress' && (
            <button onClick={handleResign} className="panel px-3 py-1.5 text-xs text-[var(--color-danger)] hover:opacity-80">
              {t.resign[lang]}
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-xl flex items-start justify-between mb-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className={chessRef.current.turn() === 'b' && game.status === 'InProgress' ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text-dim)]'}>
            {chessRef.current.turn() === 'b' && game.status === 'InProgress' && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: 'var(--color-accent)' }} />}
            ♚ {game.blackPlayerName || 'Waiting…'}
          </span>
          <CapturedRow pieces={captured.w} color="w" />
        </div>
        <span className="text-[var(--color-text-dim)] font-mono text-xs mt-0.5">{statusLabel()}</span>
        <div className="flex flex-col gap-1 items-end">
          <span className={chessRef.current.turn() === 'w' && game.status === 'InProgress' ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text-dim)]'}>
            ♔ {game.whitePlayerName}
            {chessRef.current.turn() === 'w' && game.status === 'InProgress' && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle" style={{ background: 'var(--color-accent)' }} />}
          </span>
          <CapturedRow pieces={captured.b} color="b" />
        </div>
      </div>

      <div
        className={`chess-board skin-${boardSkin} grid grid-cols-8 rounded-lg overflow-hidden w-full max-w-xl aspect-square${boardShake ? ' board-shake' : ''}`}
        style={{ gridTemplateRows: 'repeat(8, 1fr)', border: '10px solid var(--board-border)' }}
      >
        {board.map((row, ri) =>
          row.map((cell, ci) => {
            const square = `${FILES[ci]}${RANKS[ri]}` as Square
            const isDark = (ri + ci) % 2 === 1
            const isSelected = selected === square
            const isTarget = legalTargets.includes(square)
            const isCheckedKing = inCheckKingSquare === square
            return (
              <button
                key={square}
                onClick={() => handleSquareClick(square)}
                className="relative flex items-center justify-center text-3xl md:text-4xl select-none"
                style={{
                  background: isDark ? 'var(--board-dark)' : 'var(--board-light)',
                  boxShadow: [
                    isSelected ? 'inset 0 0 0 999px var(--board-highlight)' : '',
                    isCheckedKing ? 'inset 0 0 0 3px var(--color-danger), 0 0 16px 3px var(--color-danger)' : '',
                  ]
                    .filter(Boolean)
                    .join(', ') || undefined,
                }}
              >
                {cell && (
                  <span
                    className={kingShake?.square === square ? 'king-tremble' : undefined}
                    style={{
                      color: cell.color === 'w' ? 'var(--board-piece-white)' : 'var(--board-piece-black)',
                      // Four 1px-offset drop-shadows in the outline color build a solid
                      // ring around the glyph — this is what keeps a piece visible even
                      // when its fill color exactly matches the square behind it (see
                      // .chess-board.skin-bw in index.css).
                      filter:
                        cell.color === 'w'
                          ? 'drop-shadow(1px 0 0 var(--board-piece-white-outline)) drop-shadow(-1px 0 0 var(--board-piece-white-outline)) drop-shadow(0 1px 0 var(--board-piece-white-outline)) drop-shadow(0 -1px 0 var(--board-piece-white-outline))'
                          : 'drop-shadow(1px 0 0 var(--board-piece-black-outline)) drop-shadow(-1px 0 0 var(--board-piece-black-outline)) drop-shadow(0 1px 0 var(--board-piece-black-outline)) drop-shadow(0 -1px 0 var(--board-piece-black-outline))',
                      display: 'inline-block',
                    }}
                  >
                    {PIECE_GLYPHS[`${cell.color}${cell.type}`]}
                  </span>
                )}
                {ci === 0 && (
                  <span
                    className="absolute top-0.5 left-1 text-[10px] font-mono select-none"
                    style={{ opacity: 0.75, color: isDark ? 'var(--board-light)' : 'var(--board-dark)' }}
                  >
                    {RANKS[ri]}
                  </span>
                )}
                {ri === 7 && (
                  <span
                    className="absolute bottom-0.5 right-1 text-[10px] font-mono select-none"
                    style={{ opacity: 0.75, color: isDark ? 'var(--board-light)' : 'var(--board-dark)' }}
                  >
                    {FILES[ci]}
                  </span>
                )}
                {isTarget && (
                  <span
                    className="absolute w-3 h-3 rounded-full"
                    style={{ background: cell ? 'transparent' : 'var(--board-target-dot)', opacity: 0.7, boxShadow: cell ? 'inset 0 0 0 3px var(--board-target-dot)' : 'none' }}
                  />
                )}
                {captureFx && captureFx.square === square && (
                  <span key={captureFx.id} className={`capture-fx capture-fx-${captureFx.type}`} />
                )}
              </button>
            )
          }),
        )}
      </div>

      {pendingPromotion && myColorChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="panel p-6 max-w-xs w-full text-center">
            <p className="text-sm text-[var(--color-text-dim)] mb-4">اختار القطعة اللي عايزها / Choose the piece</p>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const { from, to } = pendingPromotion
                    setPendingPromotion(null)
                    commitMove(from, to, type)
                  }}
                  className="panel aspect-square flex items-center justify-center text-4xl hover:opacity-80"
                  style={{ color: myColorChar === 'w' ? 'var(--color-text)' : 'var(--color-accent)' }}
                >
                  {PIECE_GLYPHS[`${myColorChar}${type}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {game.moveHistory && (
        <p className="max-w-xl w-full mt-4 text-xs text-[var(--color-text-dim)] font-mono break-words">
          {game.moveHistory}
        </p>
      )}
    </div>
  )
}
