import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/Header'
import Navigation from '@/components/Navigation'
import SetPasswordModal from '@/components/SetPasswordModal'
import Recommend from '@/pages/Recommend'
import Randomizer from '@/pages/Randomizer'
import SavedLoadouts from '@/pages/SavedLoadouts'
import Settings from '@/pages/Settings'
import Account from '@/pages/Account'
import { planetService } from '@/services/planets'
import { loadoutService } from '@/services/loadouts'
import { onConnectivityChange } from '@/services/connectivity'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import styles from './App.module.css'

export default function App() {
  const { isSignedIn } = useAuth()
  const { showToast } = useToast()
  // Guards the once-per-sign-in merge attempt against StrictMode's double-invoke;
  // reset on sign-out so a different account on this device can still merge.
  const mergeAttempted = useRef(false)

  useEffect(() => { planetService.prefetch() }, [])

  // Drain the offline write queue whenever connectivity returns, regardless of
  // which screen is open (PRD §13.4). syncPending is a no-op when signed out.
  useEffect(() => {
    return onConnectivityChange(online => {
      if (online) void loadoutService.syncPending()
    })
  }, [])

  // First sign-in merge (PRD §6.3): migrate signed-out loadouts into the account
  // and confirm with a toast. The service is idempotent (gated by a local flag +
  // id-keyed inserts); the ref just avoids a duplicate toast in dev StrictMode.
  useEffect(() => {
    if (!isSignedIn) {
      mergeAttempted.current = false
      return
    }
    if (mergeAttempted.current) return
    mergeAttempted.current = true

    let active = true
    loadoutService.firstSignInMerge().then(result => {
      if (!active || !result || result.total === 0) return
      const { merged, total, capExceeded } = result
      if (capExceeded) {
        showToast(
          `${merged} of ${total} loadouts synced — the rest hit the 50-loadout limit. See Saved Loadouts.`,
        )
      } else if (merged === total) {
        showToast(`${merged} loadout${merged === 1 ? '' : 's'} synced to your account`)
      } else if (merged > 0) {
        showToast(`${merged} of ${total} loadouts synced — the rest will retry shortly`)
      }
    })
    return () => { active = false }
  }, [isSignedIn, showToast])

  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/recommend" replace />} />
          <Route path="/recommend/*" element={<Recommend />} />
          <Route path="/randomizer/*" element={<Randomizer />} />
          <Route path="/saved" element={<SavedLoadouts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </main>
      <Navigation />
      <SetPasswordModal />
    </div>
  )
}
