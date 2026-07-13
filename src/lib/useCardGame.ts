import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  getCardGame,
  updateCardGameState,
  getStoredUser,
  ApiError,
  type CardGame,
  type CardGameType,
} from './api'
import { createCardGameConnection } from './signalr'
import type * as signalR from '@microsoft/signalr'

export function useCardGame<TState>(
  gameId: string,
  expectedType: CardGameType,
  dealInitialState?: () => TState,
) {
  const navigate = useNavigate()
  const [game, setGame] = useState<CardGame | null>(null)
  const [state, setState] = useState<TState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  // Guards against dealing twice (StrictMode double-effect, or this effect
  // re-running before our own pushState's optimistic setState lands).
  const dealtRef = useRef(false)

  useEffect(() => {
    if (!getStoredUser()) {
      navigate({ to: '/login' })
      return
    }
    getCardGame(gameId)
      .then((g) => {
        if (g.gameType !== expectedType) {
          setError('This link is for a different game.')
          return
        }
        setGame(g)
        try {
          const parsed = JSON.parse(g.stateJson) as TState
          // The backend seeds a brand-new game with an empty "{}" placeholder
          // (not null), before the first move has ever been pushed. Treat
          // that placeholder as "no state yet" so callers fall back to their
          // own newGame() instead of using a shape-less object.
          const hasContent = parsed !== null && typeof parsed === 'object' && Object.keys(parsed as object).length > 0
          setState(hasContent ? parsed : null)
        } catch {
          setState(null)
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate({ to: '/login' })
        else setError('Could not load this game.')
      })
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => {
    let cancelled = false
    const connection = createCardGameConnection()
    connectionRef.current = connection

    connection.on('PlayerJoined', (payload: { player2Id: string; player2Name: string }) => {
      setGame((prev) =>
        prev ? { ...prev, player2Id: payload.player2Id, player2Name: payload.player2Name } : prev,
      )
    })

    connection.on('ReceiveState', (payload: { stateJson: string; status: string; winnerId: string | null }) => {
      try {
        const parsed = JSON.parse(payload.stateJson) as TState
        const hasContent = parsed !== null && typeof parsed === 'object' && Object.keys(parsed as object).length > 0
        if (hasContent) setState(parsed)
      } catch {
        // ignore malformed payload
      }
      setGame((prev) =>
        prev
          ? { ...prev, status: payload.status as CardGame['status'], winnerId: payload.winnerId }
          : prev,
      )
    })

    // See ChessGame.tsx for why this is deferred by a tick — it stops
    // React StrictMode's dev-only double-invoke from ever starting a
    // phantom connection that has to be aborted (and logged) mid-negotiation.
    const startTimer = setTimeout(() => {
      if (cancelled) return
      connection
        .start()
        .then(() => {
          if (!cancelled) connection.invoke('JoinGame', gameId)
        })
        .catch((err) => {
          if (!cancelled) console.error('Card game connection failed to start:', err)
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

  // Seed the match: card/domino games start from a random shuffle, unlike
  // chess's fixed starting position, so it can't just be recomputed
  // independently on both screens — that's what produced two different
  // "opponent's turn" screens (each side quietly dealt itself a different
  // deck). Only Player 1's tab deals, once, and pushes it as the single
  // source of truth; Player 2 always waits for that push instead of ever
  // calling its own local newGame().
  useEffect(() => {
    if (!dealInitialState) return
    if (!game || state) return
    if (game.status !== 'WaitingForOpponent' && game.status !== 'InProgress') return
    if (game.mySeat !== 1 || !game.player2Id) return
    if (dealtRef.current) return
    dealtRef.current = true

    const initial = dealInitialState()
    setState(initial)
    setGame((prev) => (prev ? { ...prev, status: 'InProgress' } : prev))
    const stateJson = JSON.stringify(initial)
    updateCardGameState(gameId, stateJson, 'InProgress', null).catch(() => {})
    connectionRef.current?.invoke('SendState', gameId, stateJson, 'InProgress', null).catch(() => {})
  }, [game, state, dealInitialState, gameId])

  const pushState = (next: TState, status: CardGame['status'], winnerId: string | null) => {
    setState(next)
    setGame((prev) => (prev ? { ...prev, status, winnerId } : prev))
    const stateJson = JSON.stringify(next)
    updateCardGameState(gameId, stateJson, status, winnerId).catch(() => {})
    connectionRef.current?.invoke('SendState', gameId, stateJson, status, winnerId).catch(() => {})
  }

  return { game, state, loading, error, pushState }
}
