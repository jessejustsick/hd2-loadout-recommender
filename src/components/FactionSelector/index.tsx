import type { FactionId } from '@/types'
import { factionIconUrl } from '@/lib/factionIcons'
import styles from './FactionSelector.module.css'

const FACTIONS: { id: FactionId; label: string }[] = [
  { id: 'terminids', label: 'Terminids' },
  { id: 'automatons', label: 'Automatons' },
  { id: 'illuminate', label: 'Illuminate' },
]

interface Props {
  value: FactionId | null
  onChange: (faction: FactionId) => void
}

export default function FactionSelector({ value, onChange }: Props) {
  return (
    <div className={styles.control} role="group" aria-label="Select faction">
      {FACTIONS.map(({ id, label }) => (
        <button
          key={id}
          className={`${styles.segment} ${styles[id]} ${value === id ? styles.selected : ''}`}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
        >
          <img src={factionIconUrl[id]} alt="" className={styles.icon} />
          {label}
        </button>
      ))}
    </div>
  )
}
