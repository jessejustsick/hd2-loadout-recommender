import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { authService, type AuthErrorCode } from '@/services/auth'
import styles from './SignInModal.module.css'

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'forgot-sent'

interface SignInModalProps {
  open: boolean
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 6

// PRD §4.5 — service error codes mapped to user-facing copy in the UI layer.
function errorCopy(code: AuthErrorCode): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_exists':
      return 'An account with this email exists. Try signing in instead.'
    case 'email_not_confirmed':
      return 'Verify your email to sign in. Check your inbox for the verification link.'
    case 'oauth_failed':
      return "Couldn't sign in with Google. Try again or use email."
    case 'rate_limited':
      return 'Too many attempts. Try again in a little while.'
    case 'network':
      return "Couldn't connect. Try again."
    default:
      return 'Something went wrong. Try again.'
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

export default function SignInModal({ open, onClose }: SignInModalProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false) // show "Resend" affordance on sign-in
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  // Reset to a clean sign-in state whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setMode('signin')
      setEmail('')
      setPassword('')
      setFieldError({})
      setFormError(null)
      setUnverified(false)
      setResent(false)
    }
  }, [open])

  // Focus the first field on open / mode change to a form view.
  useEffect(() => {
    if (open && (mode === 'signin' || mode === 'signup' || mode === 'forgot')) {
      emailRef.current?.focus()
    }
  }, [open, mode])

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function clearErrors() {
    setFieldError({})
    setFormError(null)
    setUnverified(false)
  }

  function validate(requirePassword: boolean): boolean {
    const next: { email?: string; password?: string } = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (requirePassword && password.length < MIN_PASSWORD) {
      next.password = `Password must be at least ${MIN_PASSWORD} characters.`
    }
    setFieldError(next)
    return Object.keys(next).length === 0
  }

  async function handleSignIn() {
    clearErrors()
    if (!validate(true)) return
    setBusy(true)
    const { error } = await authService.signIn(email.trim(), password)
    setBusy(false)
    if (error) {
      setFormError(errorCopy(error))
      setUnverified(error === 'email_not_confirmed')
      return
    }
    onClose() // onAuthStateChange will flip the app into signed-in state
  }

  async function handleSignUp() {
    clearErrors()
    if (!validate(true)) return
    setBusy(true)
    const { error } = await authService.signUp(email.trim(), password)
    setBusy(false)
    if (error) {
      setFormError(errorCopy(error))
      return
    }
    setMode('verify')
  }

  async function handleForgot() {
    clearErrors()
    if (!validate(false)) return
    setBusy(true)
    const { error } = await authService.sendPasswordReset(email.trim())
    setBusy(false)
    // Don't leak whether the email exists — show the sent state regardless of a
    // generic error. Only surface failures that aren't about the address itself
    // (connectivity, rate limiting), so testing/users aren't misled by a silent drop.
    if (error === 'network' || error === 'rate_limited') {
      setFormError(errorCopy(error))
      return
    }
    setMode('forgot-sent')
  }

  async function handleGoogle() {
    clearErrors()
    setBusy(true)
    const { error } = await authService.signInWithGoogle()
    // On success the browser redirects away; only failures return here.
    if (error) {
      setBusy(false)
      setFormError(errorCopy(error))
    }
  }

  async function handleResend() {
    setBusy(true)
    await authService.resendVerificationEmail(email.trim())
    setBusy(false)
    setResent(true)
  }

  const isForm = mode === 'signin' || mode === 'signup'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        onClick={e => e.stopPropagation()}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>

        {/* ---- Verification confirmation (PRD §4.4) ---- */}
        {mode === 'verify' && (
          <div className={styles.body}>
            <h2 id="signin-title" className={styles.title}>Check your email</h2>
            <p className={styles.lead}>
              We sent a verification link to <strong>{email.trim()}</strong>. Click the link to
              activate your account.
            </p>
            {resent ? (
              <p className={styles.hint}>Verification email sent again.</p>
            ) : (
              <button className={styles.textLink} onClick={handleResend} disabled={busy}>
                Resend verification email
              </button>
            )}
          </div>
        )}

        {/* ---- Forgot-password sent ---- */}
        {mode === 'forgot-sent' && (
          <div className={styles.body}>
            <h2 id="signin-title" className={styles.title}>Check your email</h2>
            <p className={styles.lead}>
              If an account exists for <strong>{email.trim()}</strong>, we sent a link to reset
              your password.
            </p>
            <button className={styles.textLink} onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          </div>
        )}

        {/* ---- Forgot-password request ---- */}
        {mode === 'forgot' && (
          <div className={styles.body}>
            <h2 id="signin-title" className={styles.title}>Reset password</h2>
            <p className={styles.lead}>Enter your email and we'll send a reset link.</p>
            {formError && <p className={styles.formError}>{formError}</p>}
            <label className={styles.label} htmlFor="reset-email">Email</label>
            <input
              ref={emailRef}
              id="reset-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={!!fieldError.email}
            />
            {fieldError.email && <p className={styles.fieldError}>{fieldError.email}</p>}
            <button className={styles.primary} onClick={handleForgot} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button className={styles.textLink} onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          </div>
        )}

        {/* ---- Sign in / Create account ---- */}
        {isForm && (
          <div className={styles.body}>
            <h2 id="signin-title" className={styles.title}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h2>

            {formError && (
              <p className={styles.formError}>
                {formError}
                {unverified && (
                  <>
                    {' '}
                    {resent ? (
                      <span className={styles.hintInline}>Verification email sent.</span>
                    ) : (
                      <button className={styles.inlineLink} onClick={handleResend} disabled={busy}>
                        Resend verification email
                      </button>
                    )}
                  </>
                )}
              </p>
            )}

            <label className={styles.label} htmlFor="email">Email</label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={!!fieldError.email}
            />
            {fieldError.email && <p className={styles.fieldError}>{fieldError.email}</p>}

            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              aria-invalid={!!fieldError.password}
              onKeyDown={e => {
                if (e.key === 'Enter') mode === 'signin' ? handleSignIn() : handleSignUp()
              }}
            />
            {fieldError.password && <p className={styles.fieldError}>{fieldError.password}</p>}

            {mode === 'signin' && (
              <button className={styles.forgot} onClick={() => { clearErrors(); setMode('forgot') }}>
                Forgot password?
              </button>
            )}

            <button
              className={styles.primary}
              onClick={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={busy}
            >
              {busy
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <button
              className={styles.toggle}
              onClick={() => { clearErrors(); setMode(mode === 'signin' ? 'signup' : 'signin') }}
            >
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>

            <div className={styles.divider}><span>or</span></div>

            <button className={styles.google} onClick={handleGoogle} disabled={busy}>
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
