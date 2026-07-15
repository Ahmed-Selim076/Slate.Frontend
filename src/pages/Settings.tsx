import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { getProfile, updateProfile, updateAvatar, deleteAvatar, changePassword, getStoredUser, ApiError } from '../lib/api'
import './landing.css'

// Reads the file, draws it into a fixed-size square canvas (cropping to
// cover, like object-fit: cover) and re-encodes as JPEG. Keeps every upload
// small and square regardless of the source photo, since the backend just
// stores this as a data URL inline on the user row.
function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Could not process that image.'))

        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)

        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function Settings() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [nameError, setNameError] = useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'uploading' | 'removing' | 'error'>('idle')
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setAvatarUrl(p.avatarUrl)
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

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarStatus('error')
      setAvatarError('Please choose an image file.')
      return
    }

    setAvatarStatus('uploading')
    setAvatarError(null)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const profile = await updateAvatar(dataUrl)
      setAvatarUrl(profile.avatarUrl)
      setAvatarStatus('idle')
    } catch (err) {
      setAvatarStatus('error')
      setAvatarError(err instanceof ApiError ? err.message : 'Could not upload that photo.')
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarStatus('removing')
    setAvatarError(null)
    try {
      const profile = await deleteAvatar()
      setAvatarUrl(profile.avatarUrl)
      setAvatarStatus('idle')
    } catch (err) {
      setAvatarStatus('error')
      setAvatarError(err instanceof ApiError ? err.message : 'Could not remove that photo.')
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
    <div className="ld-page min-h-screen">
      <nav className="ld-nav flex items-center justify-between px-8 py-4">
        <Link to="/dashboard" className="ld-nav-link flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Dashboard
        </Link>
        <span className="ld-wordmark text-base" style={{ color: 'var(--ld-paper)' }}>Settings</span>
        <span className="w-24" />
      </nav>

      <main className="max-w-lg mx-auto px-8 py-12 space-y-6">
        <div className="ld-card p-6">
          <h2 className="ld-panel-title mb-5">Profile</h2>

          <div className="flex items-center gap-4 mb-6">
            <div className="ld-avatar w-16 h-16 text-xl">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : (displayName?.[0]?.toUpperCase() ?? '?')}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarStatus === 'uploading' || avatarStatus === 'removing'}
                  className="ld-btn-secondary disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" strokeWidth={2} />
                  {avatarStatus === 'uploading' ? 'Uploading…' : 'Upload photo'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarStatus === 'uploading' || avatarStatus === 'removing'}
                    className="ld-btn-danger-text"
                  >
                    {avatarStatus === 'removing' ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
              <p className="ld-mono text-[11px] mt-2" style={{ color: 'var(--ld-paper-dim)' }}>JPG or PNG, cropped to a square.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
          </div>
          {avatarError && <p style={{ color: 'var(--ld-danger)' }} className="text-sm mb-4">{avatarError}</p>}

          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="ld-label">Email</label>
              <input value={email} disabled className="ld-input" />
            </div>
            <div>
              <label className="ld-label">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="ld-input"
              />
            </div>
            {nameError && <p style={{ color: 'var(--ld-danger)' }} className="text-sm">{nameError}</p>}
            <button type="submit" disabled={nameStatus === 'saving'} className="ld-btn-primary disabled:opacity-60">
              {nameStatus === 'saving' ? 'Saving…' : nameStatus === 'saved' ? 'Saved ✓' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="ld-card p-6">
          <h2 className="ld-panel-title mb-5">Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="ld-label">Current password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="ld-input"
              />
            </div>
            <div>
              <label className="ld-label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="ld-input"
                placeholder="At least 8 characters"
              />
            </div>
            {pwError && <p style={{ color: 'var(--ld-danger)' }} className="text-sm">{pwError}</p>}
            <button type="submit" disabled={pwStatus === 'saving'} className="ld-btn-primary disabled:opacity-60">
              {pwStatus === 'saving' ? 'Updating…' : pwStatus === 'saved' ? 'Updated ✓' : 'Update password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
