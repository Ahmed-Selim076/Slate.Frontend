import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: any
  }
}

export function useGoogleAuth(onCredential: (idToken: string) => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [width, setWidth] = useState(384)

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth)
    }
  }, [])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const setup = () => {
      if (initialized.current || !window.google || !containerRef.current) return
      initialized.current = true

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredential(response.credential),
      })

      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width,
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
  }, [onCredential, width])

  return { containerRef }
}
