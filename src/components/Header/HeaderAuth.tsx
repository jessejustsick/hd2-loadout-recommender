import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleUser } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth'
import SignInModal from '@/components/SignInModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './Header.module.css'

// Right side of the persistent chrome bar (PRD §9.1). Phase 2: "Sign in" when
// signed out; a generic account icon + lightweight menu when signed in. Phase 3
// will swap the icon to show the display name and route taps to the Account
// screen; for now the menu is the interim home for the sign-out action.
export default function HeaderAuth() {
  const { isSignedIn, user, loading } = useAuth()
  const navigate = useNavigate()

  const [signInOpen, setSignInOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const menuWrapRef = useRef<HTMLDivElement>(null)

  // Close the account menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  async function handleSignOut() {
    setBusy(true)
    await authService.signOut()
    // NOTE: clearing local user data on sign-out (PRD §4.6) is deferred to Phase 4.
    // Until sync exists, IndexedDB is the only copy of a signed-in user's loadouts,
    // so wiping it here would be irreversible data loss. The session clear below is
    // enough for Phase 2; onAuthStateChange flips the app to signed-out.
    setBusy(false)
    setConfirmOpen(false)
    setMenuOpen(false)
    navigate('/recommend')
  }

  // Avoid a flash of the wrong control during the initial session restore.
  if (loading) return <div className={styles.authSlot} aria-hidden="true" />

  return (
    <div className={styles.authSlot} ref={menuWrapRef}>
      {isSignedIn ? (
        <>
          <button
            className={styles.accountBtn}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <CircleUser size={24} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              {user?.email && <p className={styles.menuEmail}>{user.email}</p>}
              <button
                className={styles.menuItem}
                role="menuitem"
                onClick={() => { setMenuOpen(false); setConfirmOpen(true) }}
              >
                Sign out
              </button>
            </div>
          )}
        </>
      ) : (
        <button className={styles.signInBtn} onClick={() => setSignInOpen(true)}>
          Sign in
        </button>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Sign out?"
        message="Your loadouts are saved to your account and will be here next time you sign in."
        confirmLabel="Sign out"
        busy={busy}
        onConfirm={handleSignOut}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
