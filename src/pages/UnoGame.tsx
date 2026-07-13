import { useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useCardGame } from '../lib/useCardGame'
import { Centered, WaitingBanner, GameHeader } from '../lib/gameShell'
import type { Bilingual } from '../lib/gameUi'
import { getStoredUser } from '../lib/api'

type Color = 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Wild'
type Value = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'Skip' | 'Reverse' | 'Draw2' | 'Wild' | 'WildDraw4'

interface UnoCard {
  id: string
  color: Color
  value: Value
}

interface UnoState {
  hands: { p1: UnoCard[]; p2: UnoCard[] }
  drawPile: UnoCard[]
  discard: UnoCard[]
  currentColor: Color
  turn: 1 | 2
  message: string
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function fullDeck(): UnoCard[] {
  const colors: Exclude<Color, 'Wild'>[] = ['Red', 'Yellow', 'Green', 'Blue']
  const cards: UnoCard[] = []
  let n = 0
  for (const color of colors) {
    cards.push({ id: `c${n++}`, color, value: '0' })
    for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw2'] as Value[]) {
      cards.push({ id: `c${n++}`, color, value })
      cards.push({ id: `c${n++}`, color, value })
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: `c${n++}`, color: 'Wild', value: 'Wild' })
  for (let i = 0; i < 4; i++) cards.push({ id: `c${n++}`, color: 'Wild', value: 'WildDraw4' })
  return cards
}

function newGame(): UnoState {
  const deck = shuffle(fullDeck())
  const p1 = deck.slice(0, 7)
  const p2 = deck.slice(7, 14)
  let rest = deck.slice(14)
  let first = rest.pop()!
  while (first.color === 'Wild') {
    rest.unshift(first)
    rest = shuffle(rest)
    first = rest.pop()!
  }
  return {
    hands: { p1, p2 },
    drawPile: rest,
    discard: [first],
    currentColor: first.color,
    turn: 1,
    message: 'Player 1 starts.',
  }
}

function canPlay(card: UnoCard, top: UnoCard, currentColor: Color): boolean {
  if (card.color === 'Wild') return true
  return card.color === currentColor || card.value === top.value
}

const COLOR_HEX: Record<Color, string> = { Red: '#E5686E', Yellow: '#E5C158', Green: '#4FB87D', Blue: '#4FA8E8', Wild: '#8B8D98' }

function UnoCardView({ card, dim, onClick, disabled }: { card: UnoCard; dim?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-12 h-16 rounded-lg border-2 flex items-center justify-center text-xs font-bold text-white disabled:opacity-40"
      style={{ background: COLOR_HEX[card.color], borderColor: dim ? 'transparent' : 'rgba(255,255,255,0.3)' }}
    >
      {card.value === 'WildDraw4' ? '+4' : card.value === 'Draw2' ? '+2' : card.value === 'Skip' ? '⊘' : card.value === 'Reverse' ? '⟲' : card.value === 'Wild' ? '★' : card.value}
    </button>
  )
}

const unoRules: Bilingual = {
  en: (
    <>
      <p>Each player gets 7 cards. Match the top discard by color, number, or symbol — or play a Wild.</p>
      <p>Number cards: no effect. Skip/Reverse: opponent misses their next turn (same thing with 2 players). Draw 2: opponent draws 2 and misses a turn.</p>
      <p>Wild: pick a new color. Wild Draw 4: opponent draws 4, pick a new color, and they miss their turn.</p>
      <p>Can't play? Draw a card. First to empty their hand wins.</p>
    </>
  ),
  ar: (
    <>
      <p>كل لاعب ياخد 7 ورقات. لازم تلعب ورقة تطابق اللي فوق في اللون أو الرقم أو الرمز — أو تلعب Wild.</p>
      <p>ورق الأرقام: من غير تأثير. Skip/Reverse: الخصم يعدي دوره (نفس الأثر مع لاعبين اتنين بس). Draw 2: الخصم ياخد ورقتين ويعدي دوره.</p>
      <p>Wild: اختار لون جديد. Wild Draw 4: الخصم ياخد 4 ورقات، وانت تختار لون جديد، وهو يعدي دوره.</p>
      <p>معندكش ورقة تتلعب؟ اسحب ورقة. أول واحد يخلّص ورقه بيكسب.</p>
    </>
  ),
}

export default function UnoGame() {
  const { gameId } = useParams({ from: '/games/uno/$gameId' })
  const user = getStoredUser()
  const { game, state, loading, error, pushState } = useCardGame<UnoState>(gameId, 'Uno', newGame)
  const [pendingWild, setPendingWild] = useState<UnoCard | null>(null)

  if (loading) return <Centered>Loading…</Centered>
  if (error || !game) return <Centered error>{error || 'Game not found.'}</Centered>

  const s = state ?? newGame()
  const mySeat = game.mySeat as 1 | 2
  const isMyTurn = game.status === 'InProgress' && s.turn === mySeat
  const myHand = mySeat === 1 ? s.hands.p1 : s.hands.p2
  const oppHand = mySeat === 1 ? s.hands.p2 : s.hands.p1
  const top = s.discard[s.discard.length - 1]

  const commitPlay = (card: UnoCard, chosenColor?: Color) => {
    const nextHand = myHand.filter((c) => c.id !== card.id)
    const hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }
    let drawPile = [...s.drawPile]
    const oppSeatHand = mySeat === 1 ? [...s.hands.p2] : [...s.hands.p1]
    let skipOpp = false
    let message = `Player ${mySeat} played ${card.value === '0' || /^[1-9]$/.test(card.value) ? card.value : card.value}`

    if (card.value === 'Skip' || card.value === 'Reverse') skipOpp = true
    if (card.value === 'Draw2') {
      for (let i = 0; i < 2; i++) {
        if (drawPile.length === 0) drawPile = shuffle(s.discard.slice(0, -1))
        const d = drawPile.pop()
        if (d) oppSeatHand.push(d)
      }
      skipOpp = true
    }
    if (card.value === 'WildDraw4') {
      for (let i = 0; i < 4; i++) {
        if (drawPile.length === 0) drawPile = shuffle(s.discard.slice(0, -1))
        const d = drawPile.pop()
        if (d) oppSeatHand.push(d)
      }
      skipOpp = true
    }

    const finalHands = mySeat === 1 ? { p1: hands.p1, p2: oppSeatHand } : { p1: oppSeatHand, p2: hands.p2 }
    const nextTurn: 1 | 2 = skipOpp ? mySeat : mySeat === 1 ? 2 : 1

    const next: UnoState = {
      hands: finalHands,
      drawPile,
      discard: [...s.discard, card],
      currentColor: chosenColor || card.color,
      turn: nextTurn,
      message,
    }

    const iWon = finalHands.p1.length === 0 || finalHands.p2.length === 0
    if (iWon) {
      const winnerId = finalHands.p1.length === 0 ? game.player1Id : game.player2Id
      pushState(next, 'Finished', winnerId)
    } else {
      pushState(next, 'InProgress', null)
    }
    setPendingWild(null)
  }

  const handlePlay = (card: UnoCard) => {
    if (!isMyTurn || !canPlay(card, top, s.currentColor)) return
    if (card.color === 'Wild') {
      setPendingWild(card)
      return
    }
    commitPlay(card)
  }

  const handleDraw = () => {
    if (!isMyTurn) return
    let drawPile = [...s.drawPile]
    let discard = s.discard
    if (drawPile.length === 0) {
      drawPile = shuffle(discard.slice(0, -1))
      discard = [discard[discard.length - 1]]
    }
    const drawn = drawPile.pop()
    if (!drawn) return
    const nextHand = [...myHand, drawn]
    const hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }
    const next: UnoState = {
      hands,
      drawPile,
      discard,
      currentColor: s.currentColor,
      turn: mySeat === 1 ? 2 : 1,
      message: `Player ${mySeat} drew a card.`,
    }
    pushState(next, 'InProgress', null)
  }

  const resultLabel = () => {
    if (game.status !== 'Finished') return s.message
    if (game.winnerId === user?.userId) return 'You win! 🎉'
    return `${game.winnerId === game.player1Id ? game.player1Name : game.player2Name} wins!`
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-10 px-4">
      <GameHeader title="UNO" rulesKey="uno" rules={unoRules} />

      {!game.player2Id ? (
        <WaitingBanner />
      ) : !state ? (
        <Centered>Dealing the hand…</Centered>
      ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <div className="flex gap-1">
            {oppHand.map((_, i) => (
              <div key={i} className="w-9 h-12 rounded-md" style={{ background: 'var(--color-surface-elevated)' }} />
            ))}
          </div>

          <p className="text-sm text-[var(--color-accent)] text-center">{resultLabel()}</p>

          <div className="flex items-center gap-4">
            <UnoCardView card={top} disabled />
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
              <span>Current color:</span>
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: COLOR_HEX[s.currentColor] }} />
            </div>
          </div>

          {pendingWild ? (
            <div className="flex gap-2">
              {(['Red', 'Yellow', 'Green', 'Blue'] as Color[]).map((c) => (
                <button
                  key={c}
                  onClick={() => commitPlay(pendingWild, c)}
                  className="w-10 h-10 rounded-full border-2 border-white/30"
                  style={{ background: COLOR_HEX[c] }}
                  title={c}
                />
              ))}
            </div>
          ) : (
            isMyTurn && game.status === 'InProgress' && (
              <button onClick={handleDraw} className="btn-secondary text-sm">
                Draw a card ({s.drawPile.length} left)
              </button>
            )
          )}

          <div className="flex gap-1 flex-wrap justify-center">
            {myHand.map((c) => (
              <UnoCardView key={c.id} card={c} onClick={() => handlePlay(c)} disabled={!isMyTurn || game.status !== 'InProgress' || !canPlay(c, top, s.currentColor)} />
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">Your hand — {isMyTurn ? 'your turn' : "opponent's turn"}</p>
        </div>
      )}
    </div>
  )
}
