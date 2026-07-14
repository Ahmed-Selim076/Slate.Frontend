import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import AuthSidePanel from '../components/AuthSidePanel'
import { register, googleLogin, ApiError } from '../lib/api'
import { useGoogleAuth } from '../lib/useGoogleAuth'

export default function Register() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(email, password, displayName)
      navigate({ to: '/dashboard' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleCredential = async (idToken: string) => {
    setError(null)
    setLoading(true)
    try {
      await googleLogin(idToken)
      navigate({ to: '/dashboard' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const { containerRef } = useGoogleAuth(handleGoogleCredential)

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[var(--color-bg)]">
      <AuthSidePanel
        heading="Bring your team to the same page."
        subheading="Free to start. No credit card needed."
      />

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-lg font-semibold block mb-10 fade-up md:hidden">
            Slate
          </Link>

          <h1 className="text-2xl font-semibold mb-1 fade-up">Create your account</h1>
          <p className="text-[var(--color-text-dim)] text-sm mb-8 fade-up d1">
            Start creating boards and inviting collaborators.
          </p>

          <div className="relative w-full fade-up d1">
            <button
              tabIndex={-1}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.8 36 24 36c-5.4 0-9.9-3.4-11.4-8.1l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3C40.7 36.4 44 30.8 44 24c0-1.3-.1-2.7-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
            <div
              ref={containerRef}
              className="absolute inset-0 overflow-hidden opacity-0 [&>div]:!w-full"
            />
          </div>

          <div className="flex items-center gap-3 my-6 fade-up d2">
            <div className="h-px bg-[var(--color-border)] flex-1" />
            <span className="text-xs text-[var(--color-text-dim)]">or</span>
            <div className="h-px bg-[var(--color-border)] flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="fade-up d2">
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Display name</label>
              <div className="field-wrap">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="field-underline-input"
                  placeholder="Sara Ahmed"
                />
                <span className="field-underline-bar" />
              </div>
            </div>
            <div className="fade-up d3">
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Email</label>
              <div className="field-wrap">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-underline-input"
                  placeholder="you@example.com"
                />
                <span className="field-underline-bar" />
              </div>
            </div>
            <div className="fade-up d4">
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Password</label>
              <div className="field-wrap">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-underline-input"
                  placeholder="At least 8 characters"
                />
                <span className="field-underline-bar" />
              </div>
            </div>
            {error && <p className="text-[var(--color-danger)] text-sm">{error}</p>}
            <div className="fade-up d4">
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </div>
          </form>

          <p className="text-sm text-[var(--color-text-dim)] mt-6 text-center fade-up d4">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-accent)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
