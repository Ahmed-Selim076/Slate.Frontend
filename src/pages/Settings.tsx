import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getProfile, updateProfile, changePassword, getStoredUser, ApiError } from '../lib/api'

export default function Settings() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [nameError, setNameError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    if (!getStoredUser()) {
      navigate({ to: '/login' })
      return
    }
    getProfile()
      .then((p) => {
        setEmail(p.email)
        setDisplayName(p.displayName)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate({ to: '/login' })
      })
  }, [])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameStatus('saving')
    setNameError(null)
    try {
      await updateProfile(displayName.trim())
      setNameStatus('saved')
      setTimeout(() => setNameStatus('idle'), 2000)
    } catch (err) {
      setNameStatus('error')
      setNameError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwStatus('saving')
    setPwError(null)
    try {
      await changePassword(currentPassword, newPassword)
      setPwStatus('saved')
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => setPwStatus('idle'), 2000)
    } catch (err) {
      setPwStatus('error')
      setPwError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)]">
        <Link to="/dashboard" className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm">
          ← Dashboard
        </Link>
        <span className="text-lg font-semibold">Settings</span>
        <span className="w-16" />
      </nav>

      <main className="max-w-lg mx-auto px-8 py-12 space-y-6">
        <div className="panel p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Email</label>
              <input
                value={email}
                disabled
                className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
            {nameError && <p className="text-[var(--color-danger)] text-sm">{nameError}</p>}
            <button type="submit" disabled={nameStatus === 'saving'} className="btn-primary disabled:opacity-60">
              {nameStatus === 'saving' ? 'Saving…' : nameStatus === 'saved' ? 'Saved ✓' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="panel p-6">
          <h2 className="font-semibold mb-4">Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">Current password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
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
            {pwError && <p className="text-[var(--color-danger)] text-sm">{pwError}</p>}
            <button type="submit" disabled={pwStatus === 'saving'} className="btn-primary disabled:opacity-60">
              {pwStatus === 'saving' ? 'Updating…' : pwStatus === 'saved' ? 'Updated ✓' : 'Update password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
