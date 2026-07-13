import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Board from './pages/Board'
import Settings from './pages/Settings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ChessGamePage from './pages/ChessGame'
import DominoesGame from './pages/DominoesGame'
import KoshinaGame from './pages/KoshinaGame'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: Register,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
})

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/board/$boardId',
  component: Board,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
})

const chessGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chess/$gameId',
  component: ChessGamePage,
})

const dominoesGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/dominoes/$gameId',
  component: DominoesGame,
})

const koshinaGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/koshina/$gameId',
  component: KoshinaGame,
})

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
  boardRoute,
  settingsRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  chessGameRoute,
  dominoesGameRoute,
  koshinaGameRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
