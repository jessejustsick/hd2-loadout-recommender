import { useEffect } from 'react'
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
import styles from './App.module.css'

export default function App() {
  useEffect(() => { planetService.prefetch() }, [])

  // Drain the offline write queue whenever connectivity returns, regardless of
  // which screen is open (PRD §13.4). syncPending is a no-op when signed out.
  useEffect(() => {
    return onConnectivityChange(online => {
      if (online) void loadoutService.syncPending()
    })
  }, [])

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
