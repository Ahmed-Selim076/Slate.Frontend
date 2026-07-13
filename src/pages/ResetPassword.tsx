import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { resetPassword, ApiError } from '../lib/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { token } = useSearch({ from: '/reset-password' })
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await resetPassword(token, newPassword)
      setDone(true)
      setTimeout(() => navigate({ to: '/login' }), 2000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'This reset link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="panel w-full max-w-sm p-8 fade-up">
        <Link to="/" className="text-lg font-semibold block mb-8">Slate</Link>

        {done ? (
          <>
            <h1 className="text-2xl font-semibold mb-1">Password updated ✓</h1>
            <p className="text-[var(--color-text-dim)] text-sm">Taking you to sign in…</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-1">Set a new password</h1>
            <p className="text-[var(--color-text-dim)] text-sm mb-6">
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>
              {error && <p className="text-[var(--color-danger)] text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
