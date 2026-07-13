import { useParams } from '@tanstack/react-router'
import { useCardGame } from '../lib/useCardGame'
import { CardFace, type Bilingual } from '../lib/gameUi'
import { Centered, WaitingBanner, GameHeader } from '../lib/gameShell'
import { makeDeck, shuffle, type PlayingCard } from '../lib/deck'
import { getStoredUser } from '../lib/api'

interface BassraState {
  hands: { p1: PlayingCard[]; p2: PlayingCard[] }
  drawPile: PlayingCard[]
  table: PlayingCard[]
  captured: { p1: PlayingCard[]; p2: PlayingCard[] }
  turn: 1 | 2
  message: string
}

function deal4(pile: PlayingCard[]): { hand: PlayingCard[]; rest: PlayingCard[] } {
  return { hand: pile.slice(0, 4), rest: pile.slice(4) }
}

function newGame(): BassraState {
  const deck = shuffle(makeDeck())
  const p1 = deal4(deck)
  const p2 = deal4(p1.rest)
  const table = deal4(p2.rest)
  return {
    hands: { p1: p1.hand, p2: p2.hand },
    drawPile: table.rest,
    table: table.hand,
    captured: { p1: [], p2: [] },
    turn: 1,
    message: 'Player 1 starts — play a card to capture a match, or lay it down.',
  }
}

const bassraRules: Bilingual = {
  en: (
    <>
      <p><strong>Simplified Bassra</strong> — the classic capture/fishing card game, streamlined for two players.</p>
      <p>4 cards are dealt to each hand and 4 face-up on the table. Play a card from your hand: if it matches the rank of a card on the table, you capture both into your pile. No match? Your card is laid face-up on the table instead.</p>
      <p>When your hand is empty, 4 new cards are dealt from the deck. This continues until the deck runs out.</p>
      <p>The last player to capture takes any cards left on the table. Whoever has captured the most cards overall wins.</p>
    </>
  ),
  ar: (
    <>
      <p><strong>باصرة مبسّطة</strong> — لعبة الصيد/التطابق الكلاسيكية، بنسخة مختصرة لِلاعبين اتنين.</p>
      <p>كل لاعب ياخد 4 ورقات في إيده، و4 ورقات مكشوفة على الطاولة. تلعب ورقة من إيدك: لو طابقت رتبة ورقة على الطاولة، تصيدها وتاخد الاتنين لكومتك. لو مفيش تطابق، ورقتك بتتحط مكشوفة على الطاولة.</p>
      <p>لما إيدك تفضى، بتتوزع 4 ورقات جديدة من الكوتشينة. ده بيستمر لحد ما الكوتشينة تخلص.</p>
      <p>آخر واحد يصيد ياخد أي ورق فاضل على الطاولة. اللي صاد ورق أكتر في الآخر هو الفايز.</p>
    </>
  ),
}

export default function BassraGame() {
  const { gameId } = useParams({ from: '/games/bassra/$gameId' })
  const user = getStoredUser()
  const { game, state, loading, error, pushState } = useCardGame<BassraState>(gameId, 'Bassra', newGame)

  if (loading) return <Centered>Loading…</Centered>
  if (error || !game) return <Centered error>{error || 'Game not found.'}</Centered>

  const s = state ?? newGame()
  const mySeat = game.mySeat as 1 | 2
  const isMyTurn = game.status === 'InProgress' && s.turn === mySeat
  const myHand = mySeat === 1 ? s.hands.p1 : s.hands.p2
  const oppHand = mySeat === 1 ? s.hands.p2 : s.hands.p1

  const handlePlay = (card: PlayingCard) => {
    if (!isMyTurn) return

    const matchIdx = s.table.findIndex((t) => t.rank === card.rank)
    let table = [...s.table]
    let capturedMine = mySeat === 1 ? [...s.captured.p1] : [...s.captured.p2]
    let lastCapturer: 1 | 2 | null = null
    let message: string

    if (matchIdx >= 0) {
      const [matched] = table.splice(matchIdx, 1)
      capturedMine = [...capturedMine, card, matched]
      lastCapturer = mySeat
      message = `Player ${mySeat} captured ${matched.rank}${matched.suit} with ${card.rank}${card.suit}`
    } else {
      table = [...table, card]
      message = `Player ${mySeat} laid down ${card.rank}${card.suit}`
    }

    const nextHand = myHand.filter((c) => !(c.rank === card.rank && c.suit === card.suit))
    let drawPile = [...s.drawPile]
    let hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }

    if (nextHand.length === 0 && drawPile.length > 0) {
      const { hand, rest } = deal4(drawPile)
      drawPile = rest
      hands = mySeat === 1 ? { p1: hand, p2: hands.p2 } : { p1: hands.p1, p2: hand }
    }

    const captured = mySeat === 1 ? { p1: capturedMine, p2: s.captured.p2 } : { p1: s.captured.p1, p2: capturedMine }

    const gameEnds = drawPile.length === 0 && hands.p1.length === 0 && hands.p2.length === 0
    let finalTable = table
    if (gameEnds && lastCapturer && table.length > 0) {
      const sweep = lastCapturer === 1 ? captured.p1 : captured.p2
      const swept = [...sweep, ...table]
      if (lastCapturer === 1) captured.p1 = swept
      else captured.p2 = swept
      finalTable = []
    }

    const next: BassraState = {
      hands,
      drawPile,
      table: finalTable,
      captured,
      turn: mySeat === 1 ? 2 : 1,
      message,
    }

    if (gameEnds) {
      const winnerId = captured.p1.length >= captured.p2.length ? game.player1Id : game.player2Id
      pushState(next, 'Finished', winnerId)
    } else {
      pushState(next, 'InProgress', null)
    }
  }

  const resultLabel = () => {
    if (game.status !== 'Finished') return s.message
    if (game.winnerId === user?.userId) return 'You win! 🎉'
    return `${game.winnerId === game.player1Id ? game.player1Name : game.player2Name} wins!`
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-10 px-4">
      <GameHeader title="Bassra" rulesKey="bassra" rules={bassraRules} />

      {!game.player2Id ? (
        <WaitingBanner />
      ) : !state ? (
        <Centered>Dealing the hand…</Centered>
      ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-dim)] mb-1">
              {game.player2Name} — captured {mySeat === 1 ? s.captured.p2.length : s.captured.p1.length}
            </p>
            <div className="flex gap-1">
              {oppHand.map((_, i) => (
                <CardFace key={i} faceDown />
              ))}
            </div>
          </div>

          <p className="text-sm text-[var(--color-accent)] text-center">{resultLabel()}</p>

          <div className="flex flex-wrap gap-2 justify-center min-h-[90px] items-center panel p-4">
            {s.table.length === 0 ? (
              <span className="text-xs text-[var(--color-text-dim)]">Table is empty</span>
            ) : (
              s.table.map((c, i) => <CardFace key={i} card={c} />)
            )}
          </div>
          <p className="text-xs text-[var(--color-text-dim)] -mt-4">Deck: {s.drawPile.length} cards left</p>

          <div className="flex gap-1 flex-wrap justify-center">
            {myHand.map((c, i) => (
              <div key={i} onClick={() => isMyTurn && game.status === 'InProgress' && handlePlay(c)} className={isMyTurn ? 'cursor-pointer hover:-translate-y-1 transition-transform' : 'opacity-60'}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">
            Your hand — captured {mySeat === 1 ? s.captured.p1.length : s.captured.p2.length} — {isMyTurn ? 'your turn' : "opponent's turn"}
          </p>
        </div>
      )}
    </div>
  )
}
