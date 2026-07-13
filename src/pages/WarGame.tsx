import { useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useCardGame } from '../lib/useCardGame'
import { CardFace, type Bilingual } from '../lib/gameUi'
import { Centered, WaitingBanner, GameHeader } from '../lib/gameShell'
import { makeDeck, shuffle, rankValue, type PlayingCard } from '../lib/deck'
import { getStoredUser } from '../lib/api'

interface WarState {
  p1Deck: PlayingCard[]
  p2Deck: PlayingCard[]
  pile: PlayingCard[]
  lastFlip: { p1?: PlayingCard; p2?: PlayingCard } | null
  message: string
}

function newGame(): WarState {
  const deck = shuffle(makeDeck())
  return {
    p1Deck: deck.slice(0, 26),
    p2Deck: deck.slice(26),
    pile: [],
    lastFlip: null,
    message: 'Click "Flip" to begin.',
  }
}

const warRules: Bilingual = {
  en: (
    <>
      <p>Each player gets half the deck, face down — you never see your own remaining cards, only the top one once it's flipped.</p>
      <p>Your opponent's card is shown at the top of the screen, yours at the bottom. Press "Flip" and both top cards turn face up at once.</p>
      <p>Whoever's card ranks higher (2 lowest, Ace highest) wins both cards and adds them to the bottom of their deck.</p>
      <p>If the cards tie, it's a "war" — the cards stay in the pile and you flip again; the winner of that round takes everything in the pile.</p>
      <p>Run out of cards and you lose. Most cards when nobody can play anymore wins.</p>
    </>
  ),
  ar: (
    <>
      <p>كل لاعب ياخد نص الكوتشينة، مقفولة (وشها لتحت) — مش شايف ورقك المتبقي، بس اللي بتتقلب.</p>
      <p>ورقة الخصم بتظهر فوق الشاشة، وورقتك إنت تحت. دوس "Flip" والورقتين بيتقلبوا مع بعض في نفس اللحظة.</p>
      <p>اللي ورقته أعلى (2 أقل ورقة، والأص Ace أعلى ورقة) بياخد الورقتين ويحطهم تحت الكوتشينة بتاعته.</p>
      <p>لو الورقتين متساويين، دي "حرب" — الورق فاضل في الكومة وتقلبوا تاني، واللي يكسب الجولة الجاية ياخد كل حاجة اللي في الكومة.</p>
      <p>لو خلصت ورقك، تخسر. واللي معاه ورق أكتر لما محدش يقدر يكمل بيكسب.</p>
    </>
  ),
}

export default function WarGame() {
  const { gameId } = useParams({ from: '/games/war/$gameId' })
  const user = getStoredUser()
  const { game, state, loading, error, pushState } = useCardGame<WarState>(gameId, 'War', newGame)
  const [busy, setBusy] = useState(false)

  const handleFlip = () => {
    if (!game || busy) return
    const s = state ?? newGame()
    setBusy(true)

    const pile = [...s.pile]
    const p1Deck = [...s.p1Deck]
    const p2Deck = [...s.p2Deck]

    if (p1Deck.length === 0 || p2Deck.length === 0) {
      setBusy(false)
      return
    }

    const c1 = p1Deck.shift()!
    const c2 = p2Deck.shift()!
    pile.push(c1, c2)

    let message: string
    let keepPile = false
    if (rankValue(c1.rank) > rankValue(c2.rank)) {
      p1Deck.push(...pile)
      message = `${game.player1Name} wins the round with ${c1.rank}${c1.suit}`
    } else if (rankValue(c2.rank) > rankValue(c1.rank)) {
      p2Deck.push(...pile)
      message = `${game.player2Name} wins the round with ${c2.rank}${c2.suit}`
    } else {
      message = 'War! Tie — flip again to break it'
      keepPile = true
    }

    const next: WarState = { p1Deck, p2Deck, pile: keepPile ? pile : [], lastFlip: { p1: c1, p2: c2 }, message }
    const finished = p1Deck.length === 0 || p2Deck.length === 0
    const winnerId = finished ? (p1Deck.length > 0 ? game.player1Id : game.player2Id) : null
    pushState(next, finished ? 'Finished' : 'InProgress', winnerId)
    setBusy(false)
  }

  if (loading) return <Centered>Loading…</Centered>
  if (error || !game) return <Centered error>{error || 'Game not found.'}</Centered>

  const s = state ?? newGame()
  const canPlay = game.status !== 'Finished' && game.mySeat !== 0 && game.player2Id

  const resultLabel = () => {
    if (game.status !== 'Finished') return s.message
    if (game.winnerId === user?.userId) return 'You win! 🎉'
    return `${game.winnerId === game.player1Id ? game.player1Name : game.player2Name} wins!`
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-10 px-4">
      <GameHeader title="War" rulesKey="war" rules={warRules} />

      {!game.player2Id ? (
        <WaitingBanner />
      ) : !state ? (
        <Centered>Dealing the hand…</Centered>
      ) : (
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-sm text-[var(--color-text-dim)]">{game.player2Name} — {s.p2Deck.length} cards</p>
            <div className="mt-2"><CardFace card={s.lastFlip?.p2} faceDown={!s.lastFlip} /></div>
          </div>

          <p className="text-sm text-[var(--color-accent)] text-center min-h-[20px]">{resultLabel()}</p>

          {canPlay && (
            <button onClick={handleFlip} disabled={busy} className="btn-primary disabled:opacity-60">
              Flip
            </button>
          )}

          <div className="text-center">
            <div><CardFace card={s.lastFlip?.p1} faceDown={!s.lastFlip} /></div>
            <p className="text-sm text-[var(--color-text-dim)] mt-2">{game.player1Name} — {s.p1Deck.length} cards</p>
          </div>
        </div>
      )}
    </div>
  )
}
