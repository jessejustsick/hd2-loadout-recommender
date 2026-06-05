import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authService } from '@/services/auth'
import { profileService, type UserProfile } from '@/services/profile'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isSignedIn: boolean
  loading: boolean // true until the initial session restore resolves (PRD §15.4)
  recoveryMode: boolean // user arrived via a password-recovery link; prompt for a new password
  endRecovery: () => void
  profile: UserProfile | null // null when signed out or not yet loaded
  refreshProfile: () => Promise<void> // re-pull after the Account screen saves
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    let active = true

    // Restore any persisted session on load…
    authService
      .getSession()
      .then(restored => {
        if (!active) return
        setSession(restored)
      })
      .catch(() => {
        // A failed restore just means "treat as signed out" — never block the UI.
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // …then keep in sync with sign-in / sign-out / token refresh, including the
    // session completed from an OAuth or email-verification redirect.
    const subscription = authService.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      // A recovery link lands the user in a session purely to set a new password.
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Load the profile whenever the signed-in user changes; clear it on sign-out.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let active = true
    profileService
      .getProfile()
      .then(p => { if (active) setProfile(p) })
      .catch(() => { if (active) setProfile(null) })
    return () => { active = false }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    setProfile(await profileService.getProfile())
  }, [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isSignedIn: session !== null,
    loading,
    recoveryMode,
    endRecovery: () => setRecoveryMode(false),
    profile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
