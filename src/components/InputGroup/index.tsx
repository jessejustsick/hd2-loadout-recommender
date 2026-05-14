import { useEffect, useRef, useState } from 'react'
import styles from './InputGroup.module.css'

interface Props {
  label: string
  visible: boolean
  children: React.ReactNode
}

export default function InputGroup({ label, visible, children }: Props) {
  const [rendered, setRendered] = useState(visible)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      requestAnimationFrame(() => {
        if (ref.current) {
          const top = ref.current.getBoundingClientRect().top + window.scrollY
          const viewportBottom = window.scrollY + window.innerHeight
          if (top + 100 > viewportBottom) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }
      })
    }
  }, [visible])

  if (!rendered) return null

  return (
    <div
      ref={ref}
      className={`${styles.group} ${visible ? styles.visible : styles.hidden}`}
      onAnimationEnd={() => { if (!visible) setRendered(false) }}
    >
      <p className={styles.label}>{label}</p>
      {children}
    </div>
  )
}
