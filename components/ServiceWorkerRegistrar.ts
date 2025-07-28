"use client";

import { useEffect } from 'react'
import { useConvexAuth } from 'convex/react'

export function ServiceWorkerRegistrar() {
  const { isAuthenticated } = useConvexAuth()

  useEffect(() => {
    // Only register the service worker for authenticated users and in production
    if (isAuthenticated && process.env.NODE_ENV === 'production') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope)
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error)
          })
      }
    }
  }, [isAuthenticated])

  return null // This component renders nothing
}