import { useEffect, useState } from 'react'
import { loadoutService } from '@/services/loadouts'
import styles from './Settings.module.css'

const APP_VERSION = '0.1.0'

export default function Settings() {
  const [count, setCount] = useState<number | null>(null)
  const [clearState, setClearState] = useState<'idle' | 'confirm' | 'clearing' | 'done'>('idle')

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
      <img src="/hd2-logo.svg" alt="Helldivers 2" className={styles.gameLogo} />
      <h1 className={styles.title}>Settings</h1>

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
        </div>
      </div>

      {/* Disclaimer */}
      <p className={styles.disclaimer}>
        Unofficial fan-made tool. Not affiliated with Arrowhead Game Studios or PlayStation.
        Helldivers 2 and all related content are property of their respective owners.
      </p>
    </div>
  )
}
