import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { profileService } from '@/services/profile'
import { metaService } from '@/services/loadouts'

// App-wide user preferences that the engine needs synchronously at generation
// time. Currently just the paid-items filter (PRD §7). Persistence is split by
// auth state (PRD §7.4): signed-in → `user_profiles.hide_paid_items` (via the
// profile in AuthContext), signed-out → IndexedDB `meta`.
interface SettingsContextValue {
  hidePaidItems: boolean
  setHidePaidItems: (value: boolean) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, profile, refreshProfile } = useAuth()

  // Rendered value, kept responsive via optimistic updates and resynced from
  // whichever backend is the source of truth for the current auth state.
  const [hidePaidItems, setValue] = useState(false)

  // Signed in: track the profile field (source of truth, synced across devices).
  useEffect(() => {
    if (isSignedIn) setValue(profile?.hidePaidItems ?? false)
  }, [isSignedIn, profile?.hidePaidItems])

  // Signed out: hydrate from local IndexedDB.
  useEffect(() => {
    if (isSignedIn) return
    let active = true
    metaService.get<boolean>('hidePaidItems').then(v => { if (active) setValue(!!v) })
    return () => { active = false }
  }, [isSignedIn])

  const setHidePaidItems = useCallback(async (value: boolean) => {
    setValue(value) // optimistic — keep the toggle instant
    if (isSignedIn) {
      await profileService.updateProfile({ hidePaidItems: value })
      await refreshProfile()
    } else {
      await metaService.set('hidePaidItems', value)
    }
  }, [isSignedIn, refreshProfile])

  return (
    <SettingsContext.Provider value={{ hidePaidItems, setHidePaidItems }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
