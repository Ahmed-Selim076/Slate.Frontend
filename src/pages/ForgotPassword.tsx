import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { forgotPassword, ApiError } from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { resetToken } = await forgotPassword(email)
      setSubmitted(true)
      setResetToken(resetToken)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="panel w-full max-w-sm p-8 fade-up">
        <Link to="/" className="text-lg font-semibold block mb-8">Slate</Link>

        {!submitted ? (
          <>
            <h1 className="text-2xl font-semibold mb-1">Reset your password</h1>
            <p className="text-[var(--color-text-dim)] text-sm mb-6">
              Enter your email and we'll get you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-[var(--color-danger)] text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        ) : resetToken ? (
          <>
            <h1 className="text-2xl font-semibold mb-1">Here's your link</h1>
            <p className="text-[var(--color-text-dim)] text-sm mb-4">
              This project doesn't have email sending set up yet, so here's the reset link directly
              (normally this would land in your inbox).
            </p>
            <Link
              to="/reset-password"
              search={{ token: resetToken }}
              className="btn-primary w-full block text-center"
            >
              Continue to reset
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-1">Check your email</h1>
            <p className="text-[var(--color-text-dim)] text-sm">
              If an account exists for that email, a reset link is on its way.
            </p>
          </>
        )}

        <p className="text-sm text-[var(--color-text-dim)] mt-6 text-center">
          <Link to="/login" className="text-[var(--color-accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
