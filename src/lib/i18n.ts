import { useEffect, useState } from 'react'

export type Lang = 'ar' | 'en'

const LANG_KEY = 'slate_rules_lang'
const LANG_EVENT = 'slate-langchange'

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  return (localStorage.getItem(LANG_KEY) as Lang) || 'ar'
}

export function setLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang)
  window.dispatchEvent(new Event(LANG_EVENT))
}

// Reactive language hook — every component that calls this re-renders
// whenever setLang() is called anywhere on the page (including from a
// completely different component, like the header's toggle).
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(getLang())
  useEffect(() => {
    const handler = () => setLangState(getLang())
    window.addEventListener(LANG_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(LANG_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])
  return [lang, setLang]
}

// Shared, small vocabulary every game screen needs (dashboard link, share
// button, waiting banner, "dealing…", generic win/lose, etc).
export const common = {
  dashboard: { ar: '← الرئيسية', en: '← Dashboard' },
  share: { ar: 'مشاركة', en: 'Share' },
  linkCopied: { ar: 'اتنسخ ✓', en: 'Copied ✓' },
  waitingForOpponent: { ar: 'مستنيين خصم — ابعت الرابط اللي فوق لصاحبك', en: 'Waiting for an opponent — share the link above to invite someone.' },
  dealingHand: { ar: 'بنوزع الورق…', en: 'Dealing the hand…' },
  loading: { ar: 'بتحمّل…', en: 'Loading…' },
  gameNotFound: { ar: 'اللعبة مش موجودة.', en: 'Game not found.' },
  playAgain: { ar: '🔁 جولة جديدة', en: '🔁 Play again' },
  youWin: { ar: 'أنت كسبت! 🎉', en: 'You win! 🎉' },
  opponentWins: { ar: 'كسب اللعبة', en: 'wins' },
  draw: { ar: 'تعادل', en: 'Draw' },
  yourTurn: { ar: 'دورك دلوقتي', en: 'Your turn' },
  opponentTurn: { ar: 'دور', en: "'s turn" },
} as const

export const koshinaText = {
  title: { ar: 'كوتشينة', en: 'Koshina' },
  firstMessage: { ar: 'اللاعب 1 يبدأ — العب ورقة تصيد بيها ورق من الطاولة، أو حطها لو مفيش تطابق.', en: 'Player 1 goes first — play a card to capture, or lay it down if nothing matches.' },
  jackSweptSome: (name: string, n: number) => ({ ar: `${name} لعب الولد وكسح ${n} ورقة من الطاولة!`, en: `${name} played the Jack and swept ${n} card${n === 1 ? '' : 's'} off the table!` }),
  jackSweptNone: (name: string) => ({ ar: `${name} لعب الولد — الطاولة كانت فاضية.`, en: `${name} played the Jack — the table was empty.` }),
  captured: (name: string, n: number, rank: string, suit: string) => ({
    ar: `${name} صاد ${n === 1 ? 'ورقة' : `${n} ورقات`} بـ ${rank}${suit}`,
    en: `${name} captured ${n} card${n === 1 ? '' : 's'} with ${rank}${suit}`,
  }),
  capturedSum: (name: string, n: number, rank: string, suit: string) => ({
    ar: `${name} صاد ${n} ورقات مجموعهم ${rank} بـ ${rank}${suit}`,
    en: `${name} captured ${n} cards adding up to ${rank} with ${rank}${suit}`,
  }),
  placed: (name: string, rank: string, suit: string) => ({ ar: `${name} حط ${rank}${suit} على الطاولة`, en: `${name} placed ${rank}${suit} on the table` }),
  tieExact: { ar: 'تعادل — نفس عدد الورق بالظبط 🤝', en: 'A tie — the exact same number of cards 🤝' },
  won: { ar: 'كسب اللعبة!', en: 'wins the game!' },
  deck: { ar: 'الكوم', en: 'Deck' },
  tableEmpty: { ar: 'الترابيزة فاضية', en: 'The table is empty' },
  gameOver: { ar: 'اللعبة خلصت', en: 'Game over' },
  handEmptyWaiting: { ar: 'إيدك فاضية — استنى الديلة الجديدة', en: 'Your hand is empty — waiting for the next deal' },
  yourTurnPlay: { ar: 'دورك، دوس على ورقة تلعبها', en: 'Your turn — tap a card to play it' },
  opponentTurn: (name: string) => ({ ar: `دور ${name}…`, en: `${name}'s turn…` }),
  cardsWord: { ar: 'ورقة', en: 'cards' },
  you: { ar: 'أنت', en: 'You' },
  opponent: { ar: 'الخصم', en: 'Opponent' },
} as const

export const dominoText = {
  title: { ar: 'دومينو', en: 'Dominoes' },
  yourTurnBanner: { ar: '🎲 دورك دلوقتي — اسحب بلاطة أو دوس عليها', en: '🎲 Your turn — drag a tile or tap it' },
  opponentTurnBanner: (name: string) => ({ ar: `⏳ دور ${name}…`, en: `⏳ Waiting for ${name}…` }),
  emptyBoard: { ar: 'اللوحة فاضية، حط أي قطعة', en: 'Empty board — play any tile' },
  openEnds: { ar: 'الأطراف المفتوحة', en: 'Open ends' },
  drawButton: (n: number) => ({ ar: `اسحب من الكوم (${n} فاضل)`, en: `Draw from boneyard (${n} left)` }),
  noMovesPassing: { ar: 'مفيش نقلة — هنعدي الدور…', en: 'No moves — passing…' },
  yourTiles: { ar: 'بلاطاتك', en: 'Your tiles' },
  dragToChain: { ar: 'اسحب البلاطة لمكانها في السلسلة', en: 'Drag the tile onto the chain' },
  opponentsTurn: { ar: 'دور الخصم', en: "opponent's turn" },
} as const

export const chessText = {
  title: { ar: 'شطرنج', en: 'Chess' },
  resign: { ar: 'استسلام', en: 'Resign' },
  yourMove: { ar: 'دورك تلعب', en: 'Your move' },
  waitingFor: (name: string) => ({ ar: `مستنيين ${name}`, en: `Waiting for ${name}` }),
  checkmate: (winner: string) => ({ ar: `كش ملك — ${winner} كسب`, en: `Checkmate — ${winner} wins` }),
  stalemate: { ar: 'باتة — تعادل', en: 'Stalemate — draw' },
  draw: { ar: 'تعادل', en: 'Draw' },
  resignedWin: (winner: string) => ({ ar: `${winner} كسب بالاستسلام`, en: `${winner} wins by resignation` }),
  choosePiece: { ar: 'اختار القطعة اللي عايزها', en: 'Choose the promotion piece' },
} as const
