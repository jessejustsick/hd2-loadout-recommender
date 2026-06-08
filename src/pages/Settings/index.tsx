import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { loadoutService } from '@/services/loadouts'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import SignInModal from '@/components/SignInModal'
import styles from './Settings.module.css'

const APP_VERSION = '0.1.0'

export default function Settings() {
  const { isSignedIn } = useAuth()
  const { hidePaidItems, setHidePaidItems } = useSettings()
  const navigate = useNavigate()
  const [count, setCount] = useState<number | null>(null)
  const [clearState, setClearState] = useState<'idle' | 'confirm' | 'clearing' | 'done'>('idle')
  const [signInOpen, setSignInOpen] = useState(false)

  useEffect(() => {
    loadoutService.count().then(setCount)
  }, [])

  async function handleClear() {
    if (clearState === 'idle') {
      setClearState('confirm')
      return
    }
    if (clearState === 'confirm') {
      setClearState('clearing')
      await loadoutService.deleteAll()
      setCount(0)
      setClearState('done')
      setTimeout(() => setClearState('idle'), 2000)
    }
  }

  function handleClearCancel() {
    setClearState('idle')
  }

  const clearLabel =
    clearState === 'confirm' ? 'Tap again to confirm' :
    clearState === 'clearing' ? 'Clearing…' :
    clearState === 'done' ? 'Cleared' :
    'Clear All Saved Loadouts'

  return (
    <div className={styles.page}>
      <img src="/hd2-logo.svg" alt="Hellpod Companion" className={styles.gameLogo} />
      <h1 className={styles.title}>Settings</h1>

      {/* Account section */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Account</p>
        <div className={styles.card}>
          {isSignedIn ? (
            <button className={styles.navRow} onClick={() => navigate('/account')}>
              <span className={styles.rowLabel}>Account</span>
              <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
            </button>
          ) : (
            <button className={styles.navRow} onClick={() => setSignInOpen(true)}>
              <span className={styles.rowLabel}>Sign in</span>
              <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Recommendations section */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Recommendations</p>
        <div className={styles.card}>
          <div className={styles.toggleRow}>
            <span className={styles.toggleText}>
              <span className={styles.rowLabel}>Hide paid items</span>
              <span className={styles.toggleSubLabel}>
                Recommendations will only use items available to all players.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hidePaidItems}
              aria-label="Hide paid items"
              className={`${styles.switch} ${hidePaidItems ? styles.switchOn : ''}`}
              onClick={() => void setHidePaidItems(!hidePaidItems)}
            >
              <span className={styles.switchKnob} />
            </button>
          </div>
        </div>
      </div>

      {/* Data section */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Data</p>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Saved Loadouts</span>
            <span className={styles.rowValue}>
              {count === null ? '—' : `${count} / 50`}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.clearRow}>
            <button
              className={`${styles.clearBtn} ${clearState === 'confirm' ? styles.clearBtnConfirm : ''} ${clearState === 'done' ? styles.clearBtnDone : ''}`}
              onClick={handleClear}
              disabled={clearState === 'clearing' || clearState === 'done' || count === 0}
            >
              {clearLabel}
            </button>
            {clearState === 'confirm' && (
              <button className={styles.cancelBtn} onClick={handleClearCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* About section */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>About</p>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Version</span>
            <span className={styles.rowValue}>v{APP_VERSION}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Planet Data</span>
            <span className={styles.rowValue}>api.helldivers2.dev</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Stratagem Icons</span>
            <span className={styles.rowValue}>nvigneux on GitHub</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>Image Export</span>
            <span className={styles.rowValue}>html2canvas</span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className={styles.disclaimer}>
        Unofficial fan-made tool. Not affiliated with Arrowhead Game Studios or PlayStation.
        Helldivers 2 and all related content are property of their respective owners.
      </p>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}
