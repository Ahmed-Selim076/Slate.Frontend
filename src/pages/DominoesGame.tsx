import { useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useCardGame } from '../lib/useCardGame'
import { Centered, WaitingBanner, GameHeader, Confetti } from '../lib/gameShell'
import type { Bilingual } from '../lib/gameUi'
import { getStoredUser } from '../lib/api'
import { playDominoPlaceSound, playDominoDrawSound, playDominoEndSound, unlockAudio } from '../lib/sound'
import { useLang, common, dominoText as t } from '../lib/i18n'

interface Tile {
  id: string
  a: number
  b: number
}

interface DominoState {
  hands: { p1: Tile[]; p2: Tile[] }
  boneyard: Tile[]
  chain: Tile[]
  turn: 1 | 2
  message: string
  reaction?: { seat: 1 | 2; emoji: string; ts: number }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function fullSet(): Tile[] {
  const tiles: Tile[] = []
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ id: `${a}-${b}`, a, b })
  return tiles
}

function newGame(): DominoState {
  const deck = shuffle(fullSet())
  return {
    hands: { p1: deck.slice(0, 7), p2: deck.slice(7, 14) },
    boneyard: deck.slice(14),
    chain: [],
    turn: 1,
    message: `Player 1 goes first — place any tile.`,
  }
}

function ends(chain: Tile[]): { left: number | null; right: number | null } {
  if (chain.length === 0) return { left: null, right: null }
  return { left: chain[0].a, right: chain[chain.length - 1].b }
}

function tryPlace(chain: Tile[], tile: Tile): { chain: Tile[]; ok: boolean } {
  if (chain.length === 0) return { chain: [tile], ok: true }
  const { left, right } = ends(chain)
  if (tile.a === right) return { chain: [...chain, tile], ok: true }
  if (tile.b === right) return { chain: [...chain, { ...tile, a: tile.b, b: tile.a }], ok: true }
  if (tile.b === left) return { chain: [tile, ...chain], ok: true }
  if (tile.a === left) return { chain: [{ ...tile, a: tile.b, b: tile.a }, ...chain], ok: true }
  return { chain, ok: false }
}

function hasValidMove(hand: Tile[], chain: Tile[]): boolean {
  if (chain.length === 0) return true
  return hand.some((t) => tryPlace(chain, t).ok)
}

// Like tryPlace, but the caller picks which end to target — used when a
// tile is dropped on a specific side of the chain instead of auto-placed.
function tryPlaceAtEnd(chain: Tile[], tile: Tile, end: 'left' | 'right'): { chain: Tile[]; ok: boolean } {
  if (chain.length === 0) return { chain: [tile], ok: true }
  const { left, right } = ends(chain)
  if (end === 'right') {
    if (tile.a === right) return { chain: [...chain, tile], ok: true }
    if (tile.b === right) return { chain: [...chain, { ...tile, a: tile.b, b: tile.a }], ok: true }
    return { chain, ok: false }
  }
  if (tile.b === left) return { chain: [tile, ...chain], ok: true }
  if (tile.a === left) return { chain: [{ ...tile, a: tile.b, b: tile.a }, ...chain], ok: true }
  return { chain, ok: false }
}

// Which ends of the chain a given tile could legally land on — drives which
// drop zones light up while it's being dragged.
function endEligibility(chain: Tile[], tile: Tile): { left: boolean; right: boolean } {
  if (chain.length === 0) return { left: true, right: true }
  const { left, right } = ends(chain)
  return { left: tile.a === left || tile.b === left, right: tile.a === right || tile.b === right }
}

function pipSum(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + t.a + t.b, 0)
}

// Standard 6-face pip layouts, positions on a 3x3 grid (row, col).
const PIP_LAYOUT: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
}

// A distinct color per pip count, like a real colored-dot domino set.
// Classic single-color pips (plain black), like a real ivory tile —
// matches the reference look instead of a different color per pip count.
const PIP_COLOR: Record<number, string> = {
  1: '#2E2B22',
  2: '#2E2B22',
  3: '#2E2B22',
  4: '#2E2B22',
  5: '#2E2B22',
  6: '#2E2B22',
}

const GRID_CELLS: [number, number][] = Array.from({ length: 9 }, (_, i) => [Math.floor(i / 3), i % 3])

// Fluid tile sizes (CSS clamp) so the board and hand scale smoothly from a
// small phone up to a desktop window instead of overflowing or shrinking
// to unreadable dots.
const HAND_TILE_SIZE = 'clamp(28px, 7.5vw, 34px)'
const CHAIN_TILE_SIZE = 'clamp(20px, 5.5vw, 28px)'
const BACK_TILE_SIZE = 'clamp(15px, 4vw, 22px)'

function DominoHalf({ value, size }: { value: number; size: string }) {
  const positions = PIP_LAYOUT[value] ?? []
  const color = PIP_COLOR[value] ?? '#2E3B27'
  return (
    <div className="grid grid-cols-3 grid-rows-3 domino-half" style={{ width: size, height: size, padding: '12%', gap: '6%' }}>
      {GRID_CELLS.map(([r, c]) => {
        const filled = positions.some(([pr, pc]) => pr === r && pc === c)
        return <span key={`${r}-${c}`} className={filled ? 'domino-pip' : ''} style={filled ? { background: color } : undefined} />
      })}
    </div>
  )
}

function DominoTileView({
  tile,
  onClick,
  onPointerDown,
  disabled,
  orientation = 'vertical',
  size = HAND_TILE_SIZE,
  justPlaced = false,
  draggable = false,
  dimmed = false,
}: {
  tile: Tile
  onClick?: () => void
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal'
  size?: string
  justPlaced?: boolean
  draggable?: boolean
  dimmed?: boolean
}) {
  const isVertical = orientation === 'vertical'
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      className={`domino-tile flex ${isVertical ? 'flex-col' : 'flex-row'} shrink-0 disabled:opacity-40 disabled:saturate-50${justPlaced ? ' domino-place-anim' : ''}${draggable ? ' is-draggable' : ''}${dimmed ? ' is-dragging-source' : ''}`}
    >
      <DominoHalf value={tile.a} size={size} />
      <span className="domino-divider" style={isVertical ? { height: 2, width: size } : { width: 2, height: size }} />
      <DominoHalf value={tile.b} size={size} />
    </button>
  )
}

function DominoBack({ size = HAND_TILE_SIZE }: { size?: string }) {
  return (
    <div
      className="domino-back shrink-0"
      style={{ width: size, height: `calc(${size} * 2 + 2px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span style={{ width: '30%', height: '30%', borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
    </div>
  )
}

const AVATAR_COLORS = ['#2FBE8F', '#6C8CF5', '#E5A15C', '#C1666B', '#8E6CF5', '#4FA8D8']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function PlayerBadge({ name, count, active }: { name: string; count: number; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <span
          className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold shrink-0 text-white${active ? ' avatar-pulse' : ''}`}
          style={{
            background: avatarColor(name),
            boxShadow: active ? undefined : '0 0 0 2px var(--color-surface)',
          }}
        >
          {name.charAt(0).toUpperCase() || '?'}
        </span>
        <span
          className="absolute -bottom-1 -right-1 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
          style={{ background: 'var(--color-accent)', color: '#082A20', boxShadow: '0 0 0 2px var(--color-surface)' }}
        >
          {count}
        </span>
      </div>
      <span className="text-xs truncate max-w-[6rem] text-[var(--color-text-dim)]">{name}</span>
    </div>
  )
}

function BoneyardBadge({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1 panel-elevated rounded-lg px-3 py-2 shrink-0">
      <span className="text-lg leading-none">📦</span>
      <span className="text-[10px] text-[var(--color-text-dim)]">الكوم</span>
      <span className="text-xs font-semibold">{count}</span>
    </div>
  )
}

const REACTION_EMOJIS = ['😄', '😂', '😮', '😢', '👎', '💩']

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      {open && (
        <div className="panel p-2 mb-2 grid grid-cols-3 gap-1 w-40 absolute bottom-full right-0">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
              className="text-xl hover:scale-125 transition p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="panel w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-md"
        title="تفاعلات"
      >
        {open ? '✕' : '😊'}
      </button>
    </div>
  )
}

function ReactionBubble({ emoji }: { emoji: string }) {
  return (
    <span className="absolute -top-3 -right-2 text-xl reaction-pop" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
      {emoji}
    </span>
  )
}


const dominoRules: Bilingual = {
  en: (
    <>
      <p>Each player gets 7 tiles. The rest form the boneyard.</p>
      <p>Take turns placing a tile that matches either open end of the chain — the matching numbers sit next to each other.</p>
      <p>A "double" (like 4-4) is placed sideways across the chain, same as it works on a real table.</p>
      <p>No matching tile? Draw from the boneyard until you get one, or it runs out and you pass.</p>
      <p>First to play all their tiles wins. If both players get stuck, lowest total pips in hand wins.</p>
    </>
  ),
  ar: (
    <>
      <p>كل لاعب ياخد 7 قطع. الباقي بيفضل في "الكوم".</p>
      <p>كل واحد في دوره يحط قطعة تطابق أي طرف مفتوح من السلسلة — الرقمين المتطابقين بيبقوا جنب بعض.</p>
      <p>القطعة "الدبل" (زي 4-4) بتتحط بالعرض على السلسلة، زي ما بيحصل بالظبط على الترابيزة الحقيقية.</p>
      <p>مفيش قطعة تطابق؟ اسحب من الكوم لحد ما تلاقي، ولو خلص الكوم تعدي دورك.</p>
      <p>أول واحد يخلّص قطعه بيكسب. لو الاتنين اتوقفوا، اللي مجموع نقطه أقل في إيده بيكسب.</p>
    </>
  ),
}

export default function DominoesGame() {
  const { gameId } = useParams({ from: '/games/dominoes/$gameId' })
  const [lang] = useLang()
  const user = getStoredUser()
  const { game, state, loading, error, pushState } = useCardGame<DominoState>(gameId, 'Dominoes', newGame)

  const [visibleReaction, setVisibleReaction] = useState<DominoState['reaction'] | null>(null)
  useEffect(() => {
    if (!state?.reaction) return
    setVisibleReaction(state.reaction)
    const timer = setTimeout(() => setVisibleReaction(null), 2200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.reaction?.ts])

  // Unlock the browser's audio autoplay restriction on the very first
  // interaction with the page, so a sound for the opponent's move — which
  // arrives over the network, not from a click — is allowed to play too.
  useEffect(() => {
    const unlock = () => unlockAudio()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  // Diff every incoming state (whether it's our own move or the opponent's,
  // arriving over SignalR through useCardGame) against the previous one to
  // decide which sound to play and which tile — if any — just landed on the
  // chain, so we can pop it in instead of having it just appear.
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null)
  const prevRef = useRef<{ chainIds: string[]; boneyard: number; status: string } | null>(null)
  useEffect(() => {
    if (!state) return
    const prev = prevRef.current
    const chainIds = state.chain.map((t) => t.id)
    if (prev) {
      const addedId = chainIds.find((id) => !prev.chainIds.includes(id))
      if (addedId) {
        playDominoPlaceSound()
        setJustPlacedId(addedId)
        setTimeout(() => setJustPlacedId((cur) => (cur === addedId ? null : cur)), 400)
      } else if (state.boneyard.length < prev.boneyard) {
        playDominoDrawSound()
      }
      if (prev.status !== 'Finished' && game?.status === 'Finished') {
        playDominoEndSound(game.winnerId === user?.userId)
      }
    }
    prevRef.current = { chainIds, boneyard: state.boneyard.length, status: game?.status ?? prev?.status ?? '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // --- Drag & drop for hand tiles -------------------------------------
  // Pointer-based (not native HTML5 DnD) so it works the same with mouse
  // and touch. `dragTile` is the tile currently being carried; the actual
  // drop targets (left/right end of the chain, or the whole board when
  // it's empty) live behind refs so this effect never goes stale.
  const [dragTile, setDragTile] = useState<Tile | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number; zone: 'left' | 'right' | null } | null>(null)
  const dragEligRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false })
  const boardRef = useRef<HTMLDivElement | null>(null)
  // Filled in below (after `s` exists) on every render, read by the
  // pointerup handler — keeps the effect itself free of state deps.
  const dropRef = useRef<{
    chainEmpty: boolean
    onDropLeft: (t: Tile) => void
    onDropRight: (t: Tile) => void
    onDropAny: (t: Tile) => void
  }>({ chainEmpty: true, onDropLeft: () => {}, onDropRight: () => {}, onDropAny: () => {} })

  // Whole-board hit test: dropping anywhere on the felt counts, not just a
  // thin strip at each edge. If the tile can only land on one end, that end
  // wins regardless of where it's dropped; if it fits both ends (rare —
  // e.g. a double matching both sides), whichever half of the board the
  // pointer is over decides.
  const zoneAt = (x: number, y: number): 'left' | 'right' | null => {
    const board = boardRef.current
    if (!board) return null
    const r = board.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
    const elig = dragEligRef.current
    if (elig.left && elig.right) return x < r.left + r.width / 2 ? 'left' : 'right'
    if (elig.left) return 'left'
    if (elig.right) return 'right'
    return null
  }

  useEffect(() => {
    if (!dragTile) return
    const move = (e: PointerEvent) => {
      const zone = dropRef.current.chainEmpty ? null : zoneAt(e.clientX, e.clientY)
      setDragPos({ x: e.clientX, y: e.clientY, zone })
    }
    const finish = (e: PointerEvent) => {
      const tile = dragTile
      const isEmpty = dropRef.current.chainEmpty
      const zone = isEmpty ? null : zoneAt(e.clientX, e.clientY)
      let overBoard = false
      if (isEmpty && boardRef.current) {
        const r = boardRef.current.getBoundingClientRect()
        overBoard = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      }
      setDragTile(null)
      setDragPos(null)
      if (!tile) return
      if (isEmpty) {
        if (overBoard) dropRef.current.onDropAny(tile)
        return
      }
      if (zone === 'left') dropRef.current.onDropLeft(tile)
      else if (zone === 'right') dropRef.current.onDropRight(tile)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragTile])

  if (loading) return <Centered>{common.loading[lang]}</Centered>
  if (error || !game) return <Centered error>{error || 'Game not found.'}</Centered>

  const s = state ?? newGame()
  const mySeat = game.mySeat as 1 | 2
  const isMyTurn = game.status === 'InProgress' && s.turn === mySeat
  const myHand = mySeat === 1 ? s.hands.p1 : s.hands.p2
  const oppHand = mySeat === 1 ? s.hands.p2 : s.hands.p1
  const { left, right } = ends(s.chain)

  const sendReaction = (emoji: string) => {
    pushState({ ...s, reaction: { seat: mySeat, emoji, ts: Date.now() } }, game.status, game.winnerId)
  }

  const finishTurnIfNeeded = (next: DominoState) => {
    const p1Out = next.hands.p1.length === 0
    const p2Out = next.hands.p2.length === 0
    if (p1Out || p2Out) {
      const winnerId = p1Out ? game.player1Id : game.player2Id
      pushState(next, 'Finished', winnerId)
      return
    }
    const bothStuck =
      next.boneyard.length === 0 && !hasValidMove(next.hands.p1, next.chain) && !hasValidMove(next.hands.p2, next.chain)
    if (bothStuck) {
      const p1Wins = pipSum(next.hands.p1) <= pipSum(next.hands.p2)
      pushState(next, 'Finished', p1Wins ? game.player1Id : game.player2Id)
      return
    }
    pushState(next, 'InProgress', null)
  }

  const commitPlay = (tile: Tile, chain: Tile[]) => {
    const nextHand = myHand.filter((t) => t.id !== tile.id)
    const hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }
    const next: DominoState = {
      hands,
      boneyard: s.boneyard,
      chain,
      turn: mySeat === 1 ? 2 : 1,
      message: `Player ${mySeat} played ${tile.a}-${tile.b}`,
    }
    finishTurnIfNeeded(next)
  }

  const handlePlay = (tile: Tile) => {
    if (!isMyTurn) return
    const { chain, ok } = tryPlace(s.chain, tile)
    if (!ok) return
    commitPlay(tile, chain)
  }

  const handlePlayAt = (tile: Tile, end: 'left' | 'right') => {
    if (!isMyTurn) return
    const { chain, ok } = tryPlaceAtEnd(s.chain, tile, end)
    if (!ok) return
    commitPlay(tile, chain)
  }

  const startDrag = (tile: Tile, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMyTurn || game.status !== 'InProgress') return
    const elig = endEligibility(s.chain, tile)
    if (!elig.left && !elig.right) return
    e.preventDefault()
    dragEligRef.current = elig
    setDragTile(tile)
    setDragPos({ x: e.clientX, y: e.clientY, zone: null })
  }

  // Latest drop targets, read by the pointerup handler set up above.
  dropRef.current = {
    chainEmpty: s.chain.length === 0,
    onDropLeft: (tile) => handlePlayAt(tile, 'left'),
    onDropRight: (tile) => handlePlayAt(tile, 'right'),
    onDropAny: (tile) => handlePlay(tile),
  }

  const handleDraw = () => {
    if (!isMyTurn || s.boneyard.length === 0) return
    const boneyard = [...s.boneyard]
    const drawn = boneyard.pop()!
    const nextHand = [...myHand, drawn]
    const hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }
    const canNowPlay = hasValidMove(nextHand, s.chain)
    const next: DominoState = {
      hands,
      boneyard,
      chain: s.chain,
      turn: canNowPlay ? s.turn : mySeat === 1 ? 2 : 1,
      message: canNowPlay ? 'Drew a tile — you can play now.' : `Player ${mySeat} drew and passed.`,
    }
    finishTurnIfNeeded(next)
  }

  const myMustDraw = isMyTurn && !hasValidMove(myHand, s.chain) && s.boneyard.length > 0
  const myMustPass = isMyTurn && !hasValidMove(myHand, s.chain) && s.boneyard.length === 0

  const resultLabel = () => {
    if (game.winnerId === user?.userId) return common.youWin[lang]
    const winnerName = game.winnerId === game.player1Id ? game.player1Name : game.player2Name
    return `${winnerName} ${common.opponentWins[lang]}!`
  }

  const oppName = (mySeat === 1 ? game.player2Name : game.player1Name) || 'الخصم'
  const dragElig = dragTile ? endEligibility(s.chain, dragTile) : { left: false, right: false }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-6 sm:py-10 px-3 sm:px-4">
      <GameHeader title={t.title[lang]} rulesKey="dominoes" rules={dominoRules} />

      {!game.player2Id ? (
        <WaitingBanner />
      ) : !state ? (
        <Centered>{common.dealingHand[lang]}</Centered>
      ) : (
        <div className="panel-elevated w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-5 p-3 sm:p-6 shadow-lg">
          {game.status === 'Finished' ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {game.winnerId === user?.userId && <Confetti />}
              <span className="text-4xl">{game.winnerId === user?.userId ? '🏆' : '🎲'}</span>
              <p
                className="text-base sm:text-lg font-bold text-center px-5 py-2 rounded-full"
                style={
                  game.winnerId === user?.userId
                    ? { background: 'var(--color-accent)', color: '#082A20' }
                    : { background: 'var(--color-surface)', color: 'var(--color-text-dim)', border: '1px solid var(--color-border)' }
                }
              >
                {resultLabel()}
              </p>
              <button onClick={() => pushState(newGame(), 'InProgress', null)} className="btn-primary text-sm px-6">
                {common.playAgain[lang]}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p
                className="text-sm sm:text-base font-bold text-center px-5 py-2 rounded-full transition-colors"
                style={
                  isMyTurn
                    ? { background: 'var(--color-accent)', color: '#082A20' }
                    : { background: 'var(--color-surface)', color: 'var(--color-text-dim)', border: '1px solid var(--color-border)' }
                }
              >
                {isMyTurn ? t.yourTurnBanner[lang] : t.opponentTurnBanner(oppName)[lang]}
              </p>
              <p className="text-[11px] text-[var(--color-text-dim)] text-center">{s.message}</p>
            </div>
          )}

          <div className="domino-stage w-full flex flex-col items-center">
            <div className="domino-rail-badge relative">
              <PlayerBadge
                name={(mySeat === 1 ? game.player2Name : game.player1Name) || 'Opponent'}
                count={oppHand.length}
                active={!isMyTurn && game.status === 'InProgress'}
              />
              {visibleReaction?.seat !== mySeat && visibleReaction && <ReactionBubble emoji={visibleReaction.emoji} />}
            </div>

            <div className="flex mb-4 flex-wrap justify-center">
              {oppHand.map((_, i) => (
                <span key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <DominoBack size={BACK_TILE_SIZE} />
                </span>
              ))}
            </div>

            <div
              ref={boardRef}
              className={`domino-oval w-full flex flex-wrap gap-1.5 justify-center items-center${dragTile && (dragElig.left || dragElig.right) ? ' is-drag-active' : ''}`}
              style={s.chain.length === 0 ? { minHeight: 'clamp(80px, 16vw, 110px)' } : undefined}
            >
              <div className="domino-boneyard-rail">
                <BoneyardBadge count={s.boneyard.length} />
              </div>
              {s.chain.length === 0 ? (
                <span className="text-xs text-[#F3E9D2] text-center" style={{ opacity: 0.85 }}>{t.emptyBoard[lang]}</span>
              ) : (
                s.chain.map((t) => (
                  <DominoTileView
                    key={t.id}
                    tile={t}
                    orientation={t.a === t.b ? 'vertical' : 'horizontal'}
                    size={CHAIN_TILE_SIZE}
                    justPlaced={t.id === justPlacedId}
                  />
                ))
              )}
              <div className="domino-reactions-corner">
                <ReactionPicker onPick={sendReaction} />
              </div>
            </div>

            <div className="domino-rail-badge relative">
              <PlayerBadge
                name={(mySeat === 1 ? game.player1Name : game.player2Name) || 'You'}
                count={myHand.length}
                active={isMyTurn && game.status === 'InProgress'}
              />
              {visibleReaction?.seat === mySeat && <ReactionBubble emoji={visibleReaction.emoji} />}
            </div>
          </div>

          {s.chain.length > 0 && (
            <p className="text-xs text-[var(--color-text-dim)] -mt-2">{t.openEnds[lang]}: {left} {lang === 'ar' ? 'و' : 'and'} {right}</p>
          )}

          {isMyTurn && game.status === 'InProgress' && (myMustDraw || myMustPass) && (
            <button onClick={handleDraw} disabled={myMustPass} className="btn-secondary text-sm">
              {myMustPass ? t.noMovesPassing[lang] : t.drawButton(s.boneyard.length)[lang]}
            </button>
          )}

          <div className="flex gap-1.5 flex-wrap justify-center">
            {myHand.map((t) => {
              const playable = !isMyTurn || game.status !== 'InProgress' ? false : tryPlace(s.chain, t).ok
              return (
                <DominoTileView
                  key={t.id}
                  tile={t}
                  orientation="vertical"
                  size={HAND_TILE_SIZE}
                  onClick={() => handlePlay(t)}
                  onPointerDown={(e) => startDrag(t, e)}
                  disabled={!isMyTurn || game.status !== 'InProgress' || !tryPlace(s.chain, t).ok}
                  draggable={playable}
                  dimmed={dragTile?.id === t.id}
                />
              )
            })}
          </div>
          <p className="text-xs text-[var(--color-text-dim)] -mt-3">
            {t.yourTiles[lang]} — {isMyTurn ? t.dragToChain[lang] : t.opponentsTurn[lang]}
          </p>
        </div>
      )}

      {dragTile && dragPos && (
        <div className="domino-tile-ghost" style={{ left: dragPos.x, top: dragPos.y }}>
          <DominoTileView tile={dragTile} orientation="vertical" size={HAND_TILE_SIZE} />
        </div>
      )}
    </div>
  )
}