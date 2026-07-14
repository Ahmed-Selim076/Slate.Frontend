import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: any
  }
}

export function useGoogleAuth(onCredential: (idToken: string) => void) {
  const hiddenButtonRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const setup = () => {
      if (initialized.current || !window.google || !hiddenButtonRef.current) return
      initialized.current = true

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredential(response.credential),
      })

      window.google.accounts.id.renderButton(hiddenButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
      })
    }

    if (window.google) {
      setup()
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          setup()
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [onCredential])

  const triggerGoogleSignIn = () => {
    const realButton = hiddenButtonRef.current?.querySelector('div[role="button"]') as HTMLElement | null
    realButton?.click()
  }

  return { hiddenButtonRef, triggerGoogleSignIn }
}
