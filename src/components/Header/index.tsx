import { useNavigate } from 'react-router-dom'
import styles from './Header.module.css'

// Persistent chrome bar shown above every screen (PRD §9.1). Phase 1 ships the
// left-side wordmark only; the right-side auth indicator is added in Phase 2.
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
      {/* Right side (auth indicator) ships in Phase 2 — intentionally empty for now. */}
    </header>
  )
}
