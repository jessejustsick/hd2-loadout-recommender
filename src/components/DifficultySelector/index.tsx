import styles from './DifficultySelector.module.css'

interface Props {
  value: number | null
  onChange: (difficulty: number) => void
}

export default function DifficultySelector({ value, onChange }: Props) {
  return (
    <div className={styles.row} role="group" aria-label="Select difficulty">
      {Array.from({ length: 10 }, (_, i) => {
        const level = i + 1
        const isSelected = value === level
        return (
          <button
            key={level}
            className={`${styles.level} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(level)}
            aria-pressed={isSelected}
            aria-label={`Difficulty ${level}`}
          >
            {level}
          </button>
        )
      })}
    </div>
  )
}
