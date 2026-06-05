import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/Header'
import Navigation from '@/components/Navigation'
import SetPasswordModal from '@/components/SetPasswordModal'
import Recommend from '@/pages/Recommend'
import Randomizer from '@/pages/Randomizer'
import SavedLoadouts from '@/pages/SavedLoadouts'
import Settings from '@/pages/Settings'
import { planetService } from '@/services/planets'
import styles from './App.module.css'

export default function App() {
  useEffect(() => { planetService.prefetch() }, [])

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
        </Routes>
      </main>
      <Navigation />
      <SetPasswordModal />
    </div>
  )
}
