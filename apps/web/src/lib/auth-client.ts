import { emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { API_ORIGIN } from '../api/client'

// Session cookies live on the API origin; `include` sends them cross-origin
// (localhost:5173 → :3001 locally, app.* → api.* in production).
export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  fetchOptions: { credentials: 'include' },
  // Better Auth calls them organizations; Relay calls them workspaces.
  plugins: [emailOTPClient(), organizationClient()],
})

export type Session = typeof authClient.$Infer.Session
