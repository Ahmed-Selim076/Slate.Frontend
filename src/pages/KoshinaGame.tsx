import { useParams } from '@tanstack/react-router'
import { useCardGame } from '../lib/useCardGame'
import { CardFace, PlayerCardBadge, type Bilingual } from '../lib/gameUi'
import { Centered, WaitingBanner, GameHeader, Confetti } from '../lib/gameShell'
import { makeDeck, shuffle, type PlayingCard } from '../lib/deck'
import { getStoredUser } from '../lib/api'
import { useLang, common, koshinaText as t } from '../lib/i18n'

interface KoshinaState {
  hands: { p1: PlayingCard[]; p2: PlayingCard[] }
  drawPile: PlayingCard[]
  table: PlayingCard[]
  captured: { p1: PlayingCard[]; p2: PlayingCard[] }
  turn: 1 | 2
  // Stored as a bilingual pair so it renders correctly for both players
  // regardless of which language each of them currently has selected.
  message: { ar: string; en: string }
}

function deal4(pile: PlayingCard[]): { hand: PlayingCard[]; rest: PlayingCard[] } {
  return { hand: pile.slice(0, 4), rest: pile.slice(4) }
}

// Numeric value used only for sum-capture (not for the Jack, which always
// sweeps instead of ever sitting around waiting to be summed).
function cardValue(rank: PlayingCard['rank']): number {
  if (rank === 'A') return 1
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  if (rank === 'J') return -1
  return parseInt(rank, 10)
}

// Finds a combination of table cards (excluding Jacks, which have no
// numeric value here) whose face values add up exactly to `target`. When
// more than one combination works, prefers the one that captures the most
// cards. Returns null if nothing sums to the target.
function findBestSumCapture(table: PlayingCard[], target: number): PlayingCard[] | null {
  const candidates = table.filter((c) => c.rank !== 'J')
  let best: PlayingCard[] | null = null

  function search(startIndex: number, remaining: number, chosen: PlayingCard[]) {
    if (remaining === 0 && chosen.length > 0) {
      if (!best || chosen.length > best.length) best = [...chosen]
      return
    }
    if (remaining < 0 || startIndex >= candidates.length) return
    for (let i = startIndex; i < candidates.length; i++) {
      const v = cardValue(candidates[i].rank)
      if (v > remaining) continue
      chosen.push(candidates[i])
      search(i + 1, remaining - v, chosen)
      chosen.pop()
    }
  }

  search(0, target, [])
  return best
}

function newGame(): KoshinaState {
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
    message: t.firstMessage,
  }
}

const koshinaRules: Bilingual = {
  ar: (
    <>
      <p><strong>الكوتشينة العادية</strong> (المعروفة بالكومي أو "قش الولد") — لعبة صيد وتجميع ورق كلاسيكية لِلاعبين اتنين.</p>
      <p>البرنامج بيوزع 4 ورقات لكل لاعب و4 ورقات مكشوفة على الطاولة تلقائي، وبعدين بتلعبوا بالدور.</p>
      <p>في دورك: العب ورقة من إيدك. فيه طريقتين تصيد بيهم:</p>
      <p>1) لو رقمها زي ورقة أو أكتر موجودة على الطاولة، تصيدها كلها.</p>
      <p>2) لو مفيش تطابق في الرقم، بس فيه مجموعة ورق على الطاولة مجموع قيمتهم يساوي رقم ورقتك (مثلاً تلعب 9 وعلى الطاولة 5 و4)، تصيد المجموعة دي كلها. (الأس = 1، الوليه = 12، الشايب = 13).</p>
      <p>لو مفيش تطابق ولا مجموع، ورقتك بتتحط على الطاولة عادي.</p>
      <p>ورقة الولد (J) هي الأقوى: لما تلعبها، تكسح كل الورق اللي على الطاولة كله وتاخده لكومتك، حتى لو مفيش تطابق أو مجموع.</p>
      <p>لما إيدك تفضى، هتاخد تلقائي 4 ورقات جديدة من الكوم — ده بيستمر لحد ما الكوم يخلص وتلعبوا آخر الأربع ورقات.</p>
      <p>آخر لاعب يصيد بياخد أي ورق فاضل على الطاولة في نهاية اللعبة. اللي بيجمع ورق أكتر في الآخر هو الكسبان.</p>
    </>
  ),
  en: (
    <>
      <p><strong>Classic Koshina</strong> (a.k.a. Komi / "the Jack sweeps") — a traditional two-player fishing/capture card game.</p>
      <p>The app automatically deals 4 cards to each player and 4 face-up on the table, then you take turns.</p>
      <p>On your turn, play a card from your hand. There are two ways to capture:</p>
      <p>1) If its rank matches one or more cards on the table, you capture all of them.</p>
      <p>2) If there's no rank match, but a combination of table cards adds up to your card's value (e.g. you play a 9 and the table has a 5 and a 4), you capture that whole combination. (Ace = 1, Queen = 12, King = 13.)</p>
      <p>No match at all? Your card is simply laid face-up on the table.</p>
      <p>Playing a Jack is special — it sweeps every card currently on the table into your pile, no match needed.</p>
      <p>When your hand is empty, you're automatically dealt 4 new cards, until the deck runs out and the last 4 cards are played.</p>
      <p>Whoever captures last takes any cards left on the table. Whoever has captured the most cards overall wins.</p>
    </>
  ),
}

export default function KoshinaGame() {
  const { gameId } = useParams({ from: '/games/koshina/$gameId' })
  const user = getStoredUser()
  const [lang] = useLang()
  const { game, state, loading, error, pushState } = useCardGame<KoshinaState>(gameId, 'Koshina', newGame)

  if (loading) return <Centered>{common.loading[lang]}</Centered>
  if (error || !game) return <Centered error>{error || common.gameNotFound[lang]}</Centered>

  const s = state ?? newGame()
  const mySeat = game.mySeat as 1 | 2
  const isMyTurn = game.status === 'InProgress' && s.turn === mySeat
  const myHand = mySeat === 1 ? s.hands.p1 : s.hands.p2
  const oppHand = mySeat === 1 ? s.hands.p2 : s.hands.p1
  const myCaptured = mySeat === 1 ? s.captured.p1 : s.captured.p2
  const oppCaptured = mySeat === 1 ? s.captured.p2 : s.captured.p1
  const oppName = (mySeat === 1 ? game.player2Name : game.player1Name) || t.opponent[lang]
  const myName = (mySeat === 1 ? game.player1Name : game.player2Name) || t.you[lang]
  const canPlay = isMyTurn && game.status === 'InProgress' && !!game.player2Id

  const handlePlay = (card: PlayingCard) => {
    if (!canPlay) return

    const isJack = card.rank === 'J'
    let table: PlayingCard[]
    let capturedFromTable: PlayingCard[]
    let message: { ar: string; en: string }

    if (isJack) {
      // "قش الولد" — the Jack sweeps the entire table, matched or not.
      capturedFromTable = [...s.table]
      table = []
      message = capturedFromTable.length > 0 ? t.jackSweptSome(myName, capturedFromTable.length) : t.jackSweptNone(myName)
    } else {
      const rankMatches = s.table.filter((c) => c.rank === card.rank)
      if (rankMatches.length > 0) {
        // Priority 1: an exact rank match beats a sum combination.
        capturedFromTable = rankMatches
        table = s.table.filter((c) => c.rank !== card.rank)
        message = t.captured(myName, rankMatches.length, card.rank, card.suit)
      } else {
        // Priority 2: no rank match → look for a combination of table cards
        // whose values add up to this card's value.
        const sumMatch = findBestSumCapture(s.table, cardValue(card.rank))
        if (sumMatch && sumMatch.length > 0) {
          capturedFromTable = sumMatch
          table = s.table.filter((c) => !sumMatch.includes(c))
          message = t.capturedSum(myName, sumMatch.length, card.rank, card.suit)
        } else {
          // No match at all → the card actually joins the table pile
          // instead of just vanishing (this was the original bug: the
          // table was only ever filtered, never appended to).
          capturedFromTable = []
          table = [...s.table, card]
          message = t.placed(myName, card.rank, card.suit)
        }
      }
    }

    const capturedThisTurn = capturedFromTable.length > 0
    const capturedMine = [...myCaptured, card, ...capturedFromTable]

    const nextHand = myHand.filter((c) => !(c.rank === card.rank && c.suit === card.suit))
    let drawPile = [...s.drawPile]
    let hands = mySeat === 1 ? { p1: nextHand, p2: s.hands.p2 } : { p1: s.hands.p1, p2: nextHand }

    // Standard rule: new cards are dealt to BOTH players together once both
    // hands are empty (not one at a time) — with equal starting hands and
    // strictly alternating single-card turns, both hands naturally hit zero
    // on the same round.
    if (hands.p1.length === 0 && hands.p2.length === 0 && drawPile.length > 0) {
      const d1 = deal4(drawPile)
      const d2 = deal4(d1.rest)
      hands = { p1: d1.hand, p2: d2.hand }
      drawPile = d2.rest
    }

    let captured = capturedThisTurn
      ? mySeat === 1
        ? { p1: capturedMine, p2: s.captured.p2 }
        : { p1: s.captured.p1, p2: capturedMine }
      : s.captured
    const lastCapturer: 1 | 2 | null = capturedThisTurn ? mySeat : null

    const gameEnds = drawPile.length === 0 && hands.p1.length === 0 && hands.p2.length === 0
    let finalTable = table
    if (gameEnds && lastCapturer && table.length > 0) {
      const sweep = lastCapturer === 1 ? captured.p1 : captured.p2
      const swept = [...sweep, ...table]
      captured = lastCapturer === 1 ? { p1: swept, p2: captured.p2 } : { p1: captured.p1, p2: swept }
      finalTable = []
    }

    const next: KoshinaState = {
      hands,
      drawPile,
      table: finalTable,
      captured,
      turn: mySeat === 1 ? 2 : 1,
      message,
    }

    if (gameEnds) {
      const p1Count = captured.p1.length
      const p2Count = captured.p2.length
      const winnerId = p1Count === p2Count ? null : p1Count > p2Count ? game.player1Id : game.player2Id
      pushState(next, 'Finished', winnerId)
    } else {
      pushState(next, 'InProgress', null)
    }
  }

  const resultLabel = () => {
    if (game.status !== 'Finished') return s.message[lang]
    if (!game.winnerId) return t.tieExact[lang]
    if (game.winnerId === user?.userId) return common.youWin[lang]
    const winnerName = game.winnerId === game.player1Id ? game.player1Name : game.player2Name
    return `${winnerName} ${t.won[lang]}`
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center py-10 px-4">
      <GameHeader title={t.title[lang]} rulesKey="koshina" rules={koshinaRules} />

      {!game.player2Id ? (
        <WaitingBanner />
      ) : !state ? (
        <Centered>{common.dealingHand[lang]}</Centered>
      ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-5">
          {game.status === 'Finished' && game.winnerId === user?.userId && <Confetti />}

          {/* Opponent */}
          <div className="flex flex-col items-center gap-2">
            <PlayerCardBadge name={oppName} count={oppCaptured.length} label={t.cardsWord[lang]} active={!isMyTurn && game.status === 'InProgress'} />
            <div className="flex gap-1 flex-wrap justify-center">
              {oppHand.map((_, i) => (
                <div key={i} className="scale-75 origin-top">
                  <CardFace faceDown />
                </div>
              ))}
              {oppHand.length === 0 && <span className="text-xs text-[var(--color-text-dim)]">—</span>}
            </div>
          </div>

          <p className="text-xs text-[var(--color-accent)] text-center min-h-[16px]">{resultLabel()}</p>

          {/* Table + deck */}
          <div className="w-full flex items-center gap-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <CardFace faceDown dim={s.drawPile.length === 0} />
              <span className="text-[10px] text-[var(--color-text-dim)]">{t.deck[lang]} ({s.drawPile.length})</span>
            </div>

            <div className="card-table flex-1 flex flex-wrap gap-1.5 justify-center items-center rounded-xl p-4 min-h-[100px]">
              {s.table.length === 0 ? (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.tableEmpty[lang]}</span>
              ) : (
                s.table.map((c, i) => <CardFace key={`${c.rank}${c.suit}-${i}`} card={c} />)
              )}
            </div>
          </div>

          {/* My hand */}
          <div className="flex gap-1.5 flex-wrap justify-center">
            {myHand.length === 0 && (
              <span className="text-xs text-[var(--color-text-dim)] py-6">
                {game.status === 'Finished' ? t.gameOver[lang] : t.handEmptyWaiting[lang]}
              </span>
            )}
            {myHand.map((c, i) => (
              <div
                key={`${c.rank}${c.suit}-${i}`}
                onClick={() => canPlay && handlePlay(c)}
                className={canPlay ? 'cursor-pointer hover:-translate-y-1 transition-transform' : 'opacity-70'}
              >
                <CardFace card={c} />
              </div>
            ))}
          </div>

          <PlayerCardBadge name={myName} count={myCaptured.length} label={t.cardsWord[lang]} active={isMyTurn && game.status === 'InProgress'} />
          {game.status !== 'Finished' && (
            <span className="text-xs text-[var(--color-text-dim)] -mt-3">
              {isMyTurn ? t.yourTurnPlay[lang] : t.opponentTurn(oppName)[lang]}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
