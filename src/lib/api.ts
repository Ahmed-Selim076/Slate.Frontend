// Base URL for the Slate.Api backend. Override by creating a `.env.local` file
// with VITE_API_BASE_URL=http://localhost:XXXX/api if your API runs on a different port.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const TOKEN_KEY = 'slate_token'
const USER_KEY = 'slate_user'

export interface AuthUser {
  userId: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      message = body.message || message
    } catch {
      // response had no JSON body — keep the default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// --- Auth ---

interface AuthResponse {
  token: string
  userId: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export async function register(email: string, password: string, displayName: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
  const user = { userId: data.userId, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl }
  storeSession(data.token, user)
  return user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const user = { userId: data.userId, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl }
  storeSession(data.token, user)
  return user
}

export async function googleLogin(idToken: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
  const user = { userId: data.userId, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl }
  storeSession(data.token, user)
  return user
}

export function logout() {
  clearSession()
}

export interface Profile {
  userId: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export async function getProfile(): Promise<Profile> {
  return apiFetch<Profile>('/auth/me')
}

export async function updateProfile(displayName: string): Promise<Profile> {
  const profile = await apiFetch<Profile>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  })
  // Keep the locally cached user (used for the avatar initial, etc.) in sync.
  const current = getStoredUser()
  if (current) {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...current, displayName: profile.displayName }))
  }
  return profile
}

// avatarDataUrl must be a "data:image/...;base64,..." string — resize/compress
// client-side (see toAvatarDataUrl in Settings.tsx) before calling this.
export async function updateAvatar(avatarDataUrl: string): Promise<Profile> {
  const profile = await apiFetch<Profile>('/auth/me/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatarDataUrl }),
  })
  const current = getStoredUser()
  if (current) {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...current, avatarUrl: profile.avatarUrl }))
  }
  return profile
}

export async function deleteAvatar(): Promise<Profile> {
  const profile = await apiFetch<Profile>('/auth/me/avatar', { method: 'DELETE' })
  const current = getStoredUser()
  if (current) {
    localStorage.setItem(USER_KEY, JSON.stringify({ ...current, avatarUrl: null }))
  }
  return profile
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// DEV MODE: the backend returns the raw reset token directly since no email
// service is wired up yet. In production this would just return 200 with no
// token, and the user would get a real email instead.
export function forgotPassword(email: string): Promise<{ resetToken: string | null }> {
  return apiFetch<{ resetToken: string | null }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}

// --- Chess ---

export interface ChessGame {
  id: string
  whitePlayerId: string
  whitePlayerName: string
  blackPlayerId: string | null
  blackPlayerName: string | null
  fen: string
  moveHistory: string
  status: 'WaitingForOpponent' | 'InProgress' | 'Checkmate' | 'Stalemate' | 'Draw' | 'Resigned'
  winner: 'None' | 'White' | 'Black'
  myColor: 'White' | 'Black' | 'Spectator'
}

export function createChessGame(): Promise<ChessGame> {
  return apiFetch<ChessGame>('/games/chess', { method: 'POST' })
}

export function getChessGame(id: string): Promise<ChessGame> {
  return apiFetch<ChessGame>(`/games/chess/${id}`)
}

export function makeChessMove(
  id: string,
  fen: string,
  san: string,
  status: ChessGame['status'],
  winner: ChessGame['winner'],
): Promise<void> {
  return apiFetch<void>(`/games/chess/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ fen, san, status, winner }),
  })
}

export function resignChessGame(id: string): Promise<void> {
  return apiFetch<void>(`/games/chess/${id}/resign`, { method: 'POST' })
}

// --- Card / tile games (Dominoes, Koshina) ---

export type CardGameType = 'Dominoes' | 'Koshina'

export interface CardGame {
  id: string
  gameType: CardGameType
  player1Id: string
  player1Name: string
  player2Id: string | null
  player2Name: string | null
  stateJson: string
  status: 'WaitingForOpponent' | 'InProgress' | 'Finished'
  winnerId: string | null
  mySeat: 0 | 1 | 2
}

export function createCardGame(gameType: CardGameType): Promise<CardGame> {
  return apiFetch<CardGame>('/games/cards', {
    method: 'POST',
    body: JSON.stringify({ gameType }),
  })
}

export function getCardGame(id: string): Promise<CardGame> {
  return apiFetch<CardGame>(`/games/cards/${id}`)
}

export function updateCardGameState(
  id: string,
  stateJson: string,
  status: CardGame['status'],
  winnerId: string | null,
): Promise<void> {
  return apiFetch<void>(`/games/cards/${id}/state`, {
    method: 'POST',
    body: JSON.stringify({ stateJson, status, winnerId }),
  })
}

// --- Boards ---

export interface BoardSummary {
  id: string
  title: string
  lastActiveAt: string
}

export interface BoardDetail {
  id: string
  title: string
  elementsJson: string
  createdAt: string
  lastActiveAt: string
  ownerId: string
  myRole: 'Owner' | 'Editor' | 'Viewer'
}

export interface BoardMember {
  userId: string
  displayName: string
  email: string
  role: 'Owner' | 'Editor' | 'Viewer'
}

export function listBoards(): Promise<BoardSummary[]> {
  return apiFetch<BoardSummary[]>('/boards')
}

export function createBoard(title: string): Promise<BoardSummary> {
  return apiFetch<BoardSummary>('/boards', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function getBoard(id: string): Promise<BoardDetail> {
  return apiFetch<BoardDetail>(`/boards/${id}`)
}

export function updateBoardElements(id: string, elementsJson: string): Promise<void> {
  return apiFetch<void>(`/boards/${id}/elements`, {
    method: 'PUT',
    body: JSON.stringify({ elementsJson }),
  })
}

export function renameBoard(id: string, title: string): Promise<void> {
  return apiFetch<void>(`/boards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function deleteBoard(id: string): Promise<void> {
  return apiFetch<void>(`/boards/${id}`, { method: 'DELETE' })
}

export function listBoardMembers(id: string): Promise<BoardMember[]> {
  return apiFetch<BoardMember[]>(`/boards/${id}/members`)
}

export function updateMemberRole(id: string, userId: string, role: 'Editor' | 'Viewer'): Promise<void> {
  return apiFetch<void>(`/boards/${id}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}
