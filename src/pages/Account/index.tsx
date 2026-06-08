import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth'
import { profileService } from '@/services/profile'
import { loadoutService } from '@/services/loadouts'
import { useToast } from '@/context/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './Account.module.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// Trim, and treat an empty string as "not set" (null) per PRD §10.3 validation.
function normalize(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function Account() {
  const { isSignedIn, loading, user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [shipName, setShipName] = useState('')
  const [playerTitle, setPlayerTitle] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadoutCount, setLoadoutCount] = useState<number | null>(null)

  // Hydrate inputs from the loaded profile.
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '')
      setShipName(profile.shipName ?? '')
      setPlayerTitle(profile.playerTitle ?? '')
    }
  }, [profile])

  // Load the saved-loadout count so the delete confirmation can name it (§4.7).
  useEffect(() => {
    loadoutService.count().then(setLoadoutCount).catch(() => setLoadoutCount(null))
  }, [])

  // Direct nav while signed out → bounce home (the entry points only show when
  // signed in, but guard the route anyway).
  if (!loading && !isSignedIn) return <Navigate to="/recommend" replace />

  async function handleSave() {
    setSaveState('saving')
    const { error } = await profileService.updateProfile({
      displayName: normalize(displayName),
      shipName: normalize(shipName),
      playerTitle: normalize(playerTitle),
    })
    if (error) {
      setSaveState('error')
      return
    }
    await refreshProfile()
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  async function handleSignOut() {
    setSigningOut(true)
    // Clear the local cache before the session ends so this account's loadouts
    // can't linger for the next (signed-out or different) user (PRD §13.8/§4.6).
    // The loadouts remain on the server; pending unsynced writes are discarded.
    await loadoutService.clearLocalData()
    await authService.signOut()
    setSigningOut(false)
    setSignOutOpen(false)
    navigate('/recommend')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    const { error } = await authService.deleteAccount()
    if (error) {
      setDeleting(false)
      setDeleteOpen(false)
      showToast("Couldn't delete your account. Please try again.")
      return
    }
    // Server data is gone (auth user + cascaded rows). Clear the local cache and
    // end the now-invalid session, then drop the user on Recommend signed-out.
    await loadoutService.clearLocalData()
    await authService.signOut()
    setDeleting(false)
    setDeleteOpen(false)
    showToast('Your account has been deleted.')
    navigate('/recommend')
  }

  const deleteMessage =
    loadoutCount && loadoutCount > 0
      ? `Your account and all ${loadoutCount} saved loadout${loadoutCount === 1 ? '' : 's'} will be permanently deleted. This can't be undone. You can still use Hellpod Companion without an account.`
      : "Your account will be permanently deleted. This can't be undone. You can still use Hellpod Companion without an account."

  const profileLoading = loading || profile === null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1 className={styles.title}>Account</h1>
      </div>

      {/* Email (read-only) */}
      <div className={styles.field}>
        <span className={styles.label}>Email</span>
        <span className={styles.email}>{user?.email ?? '—'}</span>
      </div>

      {profileLoading ? (
        <div className={styles.skeletonGroup} aria-hidden="true">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Display name</span>
            <input
              className={styles.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
              placeholder="Shown in the header"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Super Destroyer ship name</span>
            <input
              className={styles.input}
              value={shipName}
              onChange={e => setShipName(e.target.value)}
              maxLength={50}
              placeholder="e.g. SES Harbinger of Judgement"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Player title</span>
            <input
              className={styles.input}
              value={playerTitle}
              onChange={e => setPlayerTitle(e.target.value)}
              maxLength={30}
              placeholder="e.g. Death Captain"
            />
          </label>
          <p className={styles.hint}>Ship name and title appear on exported loadout images.</p>

          <button className={styles.save} onClick={handleSave} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
          {saveState === 'error' && <p className={styles.error}>Couldn't save. Try again.</p>}
        </>
      )}

      <div className={styles.divider} />

      <button className={styles.signOut} onClick={() => setSignOutOpen(true)}>
        Sign out
      </button>

      {/* Danger zone — collapsed; Delete account is scaffolded but disabled until Phase 7. */}
      <button
        className={styles.dangerToggle}
        onClick={() => setDangerOpen(o => !o)}
        aria-expanded={dangerOpen}
      >
        <span>Danger zone</span>
        <ChevronDown
          size={18}
          className={`${styles.chevron} ${dangerOpen ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>
      {dangerOpen && (
        <div className={styles.dangerBody}>
          <button className={styles.deleteBtn} onClick={() => setDeleteOpen(true)}>
            Delete account
          </button>
          <p className={styles.comingSoon}>Permanently deletes your account and all saved loadouts.</p>
        </div>
      )}

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="Your loadouts are saved to your account and will be here next time you sign in."
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setSignOutOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        message={deleteMessage}
        confirmLabel="Delete account"
        destructive
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}
