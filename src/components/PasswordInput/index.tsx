import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import styles from './PasswordInput.module.css'

// A password field with a show/hide toggle. Pass the host's input class via
// `inputClassName` so it matches each form's styling; the wrapper adds room and
// the eye button on top.
interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  inputClassName?: string
}

export default function PasswordInput({ inputClassName = '', ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className={styles.wrap}>
      <input {...props} type={show ? 'text' : 'password'} className={inputClassName} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
