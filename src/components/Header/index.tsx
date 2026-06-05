import { useNavigate } from 'react-router-dom'
import HeaderAuth from './HeaderAuth'
import styles from './Header.module.css'

// Persistent chrome bar shown above every screen (PRD §9.1): wordmark on the
// left, auth indicator on the right.
export default function Header() {
  const navigate = useNavigate()

  return (
    <header className={styles.chrome}>
      <button
        type="button"
        className={styles.wordmark}
        onClick={() => navigate('/recommend')}
        aria-label="Hellpod Companion — go to Recommend"
      >
        Hellpod Companion
      </button>
      <HeaderAuth />
    </header>
  )
}
