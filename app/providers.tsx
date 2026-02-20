"use client"

import { SessionProvider } from "next-auth/react"
import SessionInactivityGuard from "./components/SessionInactivityGuard"

export default function Providers({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SessionInactivityGuard />
      {children}
    </SessionProvider>
  )
}
