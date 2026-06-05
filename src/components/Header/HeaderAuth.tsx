import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleUser } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import SignInModal from '@/components/SignInModal'
import styles from './Header.module.css'

// Right side of the persistent chrome bar (PRD §9.1): "Sign in" when signed out;
// display name (or a generic account icon if unset) routing to the Account
// screen when signed in.
export default function HeaderAuth() {
  const { isSignedIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [signInOpen, setSignInOpen] = useState(false)

  // Avoid a flash of the wrong control during the initial session restore.
  if (loading) return <div className={styles.authSlot} aria-hidden="true" />

  return (
    <div className={styles.authSlot}>
      {isSignedIn ? (
        profile?.displayName ? (
          <button
            className={styles.displayName}
            onClick={() => navigate('/account')}
            aria-label="Account"
          >
            {profile.displayName}
          </button>
        ) : (
          <button
            className={styles.accountBtn}
            onClick={() => navigate('/account')}
            aria-label="Account"
          >
            <CircleUser size={24} aria-hidden="true" />
          </button>
        )
      ) : (
        <button className={styles.signInBtn} onClick={() => setSignInOpen(true)}>
          Sign in
        </button>
      )}

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  )
}
