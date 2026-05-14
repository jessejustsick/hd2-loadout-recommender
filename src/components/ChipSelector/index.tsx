import styles from './ChipSelector.module.css'

interface Chip {
  id: string
  label: string
}

interface SingleProps {
  multi?: false
  value: string | null
  onChange: (id: string) => void
}

interface MultiProps {
  multi: true
  value: string[]
  onChange: (ids: string[]) => void
}

type Props = (SingleProps | MultiProps) & {
  options: Chip[]
  disabled?: boolean
}

export default function ChipSelector(props: Props) {
  const { options, disabled = false } = props

  function isSelected(id: string): boolean {
    if (props.multi) return props.value.includes(id)
    return props.value === id
  }

  function handleClick(id: string) {
    if (disabled) return
    if (props.multi) {
      const next = props.value.includes(id)
        ? props.value.filter(v => v !== id)
        : [...props.value, id]
      props.onChange(next)
    } else {
      props.onChange(id)
    }
  }

  return (
    <div className={styles.chips} role="group">
      {options.map(({ id, label }) => (
        <button
          key={id}
          className={`${styles.chip} ${isSelected(id) ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
          onClick={() => handleClick(id)}
          aria-pressed={isSelected(id)}
          disabled={disabled}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
