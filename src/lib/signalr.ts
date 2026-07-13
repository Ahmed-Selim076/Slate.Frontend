import * as signalR from '@microsoft/signalr'
import { getToken } from './api'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const API_ROOT = API_BASE.replace(/\/api\/?$/, '')

export interface RemoteCursor {
  connectionId: string
  displayName: string
  x: number
  y: number
}

export function createBoardConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_ROOT}/hubs/board`, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    .build()
}

export function createChessConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_ROOT}/hubs/chess`, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    .build()
}

export function createCardGameConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_ROOT}/hubs/cardgame`, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    .build()
}
