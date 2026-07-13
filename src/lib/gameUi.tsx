import { useEffect, useState } from 'react'
import type { PlayingCard } from './deck'
import { useLang, getLang, type Lang } from './i18n'

// Pip positions on a 3-column x 5-row grid, matching the classic symmetric
// layout real playing cards use (e.g. a 5 is four corners + center).
const PIP_POSITIONS: Record<string, [number, number][]> = {
  '2': [[0, 1], [4, 1]],
  '3': [[0, 1], [2, 1], [4, 1]],
  '4': [[0, 0], [0, 2], [4, 0], [4, 2]],
  '5': [[0, 0], [0, 2], [2, 1], [4, 0], [4, 2]],
  '6': [[0, 0], [0, 2], [2, 0], [2, 2], [4, 0], [4, 2]],
  '7': [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2], [4, 0], [4, 2]],
  '8': [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2], [3, 1], [4, 0], [4, 2]],
  '9': [[0, 0], [0, 2], [1, 0], [1, 2], [2, 1], [3, 0], [3, 2], [4, 0], [4, 2]],
  '10': [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 2]],
}

function CardCenter({ rank, suit }: { rank: PlayingCard['rank']; suit: PlayingCard['suit'] }) {
  if (rank === 'A') {
    return <span className="playing-card-ace">{suit}</span>
  }
  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    return (
      <span className="playing-card-court">
        <span className="playing-card-court-rank">{rank}</span>
        <span className="playing-card-court-suit">{suit}</span>
      </span>
    )
  }
  const positions = PIP_POSITIONS[rank] ?? []
  return (
    <span className="playing-card-pips">
      {positions.map(([r, c], i) => (
        <span key={i} className="playing-card-pip" style={{ gridRow: r + 1, gridColumn: c + 1 }}>
          {suit}
        </span>
      ))}
    </span>
  )
}

export function CardFace({
  card,
  faceDown = false,
  onClick,
  dim = false,
}: {
  card?: PlayingCard
  faceDown?: boolean
  onClick?: () => void
  dim?: boolean
}) {
  const interactive = !!onClick
  const Wrapper = interactive ? 'button' : 'div'
  if (faceDown || !card) {
    return (
      <Wrapper
        onClick={onClick}
        className={`playing-card playing-card-back${interactive ? ' is-interactive' : ''}${dim ? ' is-dim' : ''}`}
      >
        <span className="playing-card-back-pattern" />
      </Wrapper>
    )
  }
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <Wrapper
      onClick={onClick}
      className={`playing-card playing-card-face${isRed ? ' is-red' : ' is-black'}${interactive ? ' is-interactive' : ''}${dim ? ' is-dim' : ''}`}
    >
      <span className="playing-card-corner playing-card-corner-tl">
        <span className="playing-card-corner-rank">{card.rank}</span>
        <span className="playing-card-corner-suit">{card.suit}</span>
      </span>
      <CardCenter rank={card.rank} suit={card.suit} />
      <span className="playing-card-corner playing-card-corner-br">
        <span className="playing-card-corner-rank">{card.rank}</span>
        <span className="playing-card-corner-suit">{card.suit}</span>
      </span>
    </Wrapper>
  )
}

export type { Lang } from './i18n'

const AVATAR_COLORS = ['#2FBE8F', '#6C8CF5', '#E5A15C', '#C1666B', '#8E6CF5', '#4FA8D8']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// A polished "who's winning right now" badge: an avatar circle with the
// player's initial, a count chip overlapping its corner, and a small label
// underneath — used to show captured/held card counts per player.
export function PlayerCardBadge({
  name,
  count,
  label,
  active,
}: {
  name: string
  count: number
  label: string
  active?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <span
          className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold shrink-0 text-white${active ? ' avatar-pulse' : ''}`}
          style={{ background: avatarColor(name), boxShadow: active ? '0 0 0 3px var(--color-accent-soft)' : undefined }}
        >
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span
          className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[11px] font-bold border-2"
          style={{ background: 'var(--color-accent)', color: '#0A0B0C', borderColor: 'var(--color-bg)' }}
        >
          {count}
        </span>
      </div>
      <span className="text-[11px] text-[var(--color-text-dim)] max-w-[80px] truncate text-center">{name}</span>
      <span className="text-[10px] text-[var(--color-text-dim)] opacity-75">{label}</span>
    </div>
  )
}

export interface Bilingual {
  en: React.ReactNode
  ar: React.ReactNode
}

export const getStoredLang = getLang

// A small, reusable "عربي / EN" pill toggle — drop it in any header so the
// whole page (not just the rules panel) can be read in either language.
export function LangToggle() {
  const [lang, changeLang] = useLang()
  return (
    <div className="flex text-xs shrink-0 rounded-md overflow-hidden border" style={{ borderColor: 'var(--color-border-hover)' }}>
      <button
        onClick={() => changeLang('ar')}
        className="px-2.5 py-1.5"
        style={{
          background: lang === 'ar' ? 'var(--color-accent)' : 'transparent',
          color: lang === 'ar' ? '#0A0B0C' : 'var(--color-text-dim)',
        }}
      >
        عربي
      </button>
      <button
        onClick={() => changeLang('en')}
        className="px-2.5 py-1.5"
        style={{
          background: lang === 'en' ? 'var(--color-accent)' : 'transparent',
          color: lang === 'en' ? '#0A0B0C' : 'var(--color-text-dim)',
        }}
      >
        EN
      </button>
    </div>
  )
}

export function RulesModal({
  gameKey,
  title,
  children,
}: {
  gameKey: string
  title: Bilingual
  children: Bilingual
}) {
  const storageKey = `slate_seen_rules_${gameKey}`
  const [open, setOpen] = useState(false)
  const [lang, changeLang] = useLang()

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      setOpen(true)
      localStorage.setItem(storageKey, '1')
    }
  }, [])

  const setAndStoreLang = (l: Lang) => changeLang(l)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="How to play / طريقة اللعب"
        className="panel h-9 px-3 flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>?</span>
        <span>{lang === 'ar' ? 'التعليمات' : 'Rules'}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="panel p-8 max-w-md w-full max-h-[80vh] overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">{title[lang]}</h2>
              <div className="flex text-xs shrink-0 rounded-md overflow-hidden border" style={{ borderColor: 'var(--color-border-hover)' }}>
                <button
                  onClick={() => setAndStoreLang('ar')}
                  className="px-2.5 py-1"
                  style={{
                    background: lang === 'ar' ? 'var(--color-accent)' : 'transparent',
                    color: lang === 'ar' ? '#0A0B0C' : 'var(--color-text-dim)',
                  }}
                >
                  عربي
                </button>
                <button
                  onClick={() => setAndStoreLang('en')}
                  className="px-2.5 py-1"
                  style={{
                    background: lang === 'en' ? 'var(--color-accent)' : 'transparent',
                    color: lang === 'en' ? '#0A0B0C' : 'var(--color-text-dim)',
                  }}
                >
                  EN
                </button>
              </div>
            </div>
            <div className="space-y-3 text-sm text-[var(--color-text-dim)] leading-relaxed">{children[lang]}</div>
            <button onClick={() => setOpen(false)} className="btn-primary w-full mt-6">
              {lang === 'ar' ? 'تمام — يلا نلعب' : "Got it — let's play"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
