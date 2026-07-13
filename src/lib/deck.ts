export interface PlayingCard {
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
  suit: '♠' | '♥' | '♦' | '♣'
}

const RANKS: PlayingCard['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: PlayingCard['suit'][] = ['♠', '♥', '♦', '♣']

export function rankValue(rank: PlayingCard['rank']): number {
  return RANKS.indexOf(rank) + 1 // A=1 ... K=13
}

export function makeDeck(): PlayingCard[] {
  const deck: PlayingCard[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit })
  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function cardId(c: PlayingCard): string {
  return `${c.rank}${c.suit}`
}
