import { useState } from 'react'
import { authService } from '@/services/auth'
import { useAuth } from '@/context/AuthContext'
import styles from './SetPasswordModal.module.css'

const MIN_PASSWORD = 6

// Completes the password-recovery flow (PRD §4.3). Renders app-level whenever a
// PASSWORD_RECOVERY event has put the app in recovery mode; the user sets a new
// password and stays signed in.
export default function SetPasswordModal() {
  const { recoveryMode, endRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!recoveryMode) return null

  function close() {
    setPassword('')
    setError(null)
    setDone(false)
    endRecovery()
  }

  async function handleSubmit() {
    setError(null)
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    const { error: err } = await authService.updatePassword(password)
    setBusy(false)
    if (err) {
      setError(err === 'network' ? "Couldn't connect. Try again." : 'Could not update password. Try again.')
      return
    }
    setDone(true)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="setpw-title">
        {done ? (
          <>
            <h2 id="setpw-title" className={styles.title}>Password updated</h2>
            <p className={styles.lead}>You're signed in with your new password.</p>
            <button className={styles.primary} onClick={close}>Done</button>
          </>
        ) : (
          <>
            <h2 id="setpw-title" className={styles.title}>Set a new password</h2>
            <p className={styles.lead}>Enter a new password for your account.</p>
            {error && <p className={styles.error}>{error}</p>}
            <label className={styles.label} htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            />
            <button className={styles.primary} onClick={handleSubmit} disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
