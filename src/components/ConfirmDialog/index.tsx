import { useEffect, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Reusable centered confirmation modal. Used for sign-out (PRD §4.6) and, in
// later phases, delete-account (§4.7) and clear-loadouts (§9.4).
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-title" className={styles.title}>{title}</h2>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`${styles.confirm} ${destructive ? styles.destructive : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
