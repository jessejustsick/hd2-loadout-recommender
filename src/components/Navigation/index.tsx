import { NavLink } from 'react-router-dom'
import { Target, Shuffle, Bookmark, Settings } from 'lucide-react'
import styles from './Navigation.module.css'

const NAV_ITEMS = [
  { to: '/recommend', label: 'Recommend', Icon: Target, end: false },
  { to: '/randomizer', label: 'Randomizer', Icon: Shuffle, end: false },
  { to: '/saved', label: 'Saved', Icon: Bookmark, end: true },
  { to: '/settings', label: 'Settings', Icon: Settings, end: true },
] as const

export default function Navigation() {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `${styles.item}${isActive ? ` ${styles.active}` : ''}`}
          aria-label={label}
        >
          <Icon size={22} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
