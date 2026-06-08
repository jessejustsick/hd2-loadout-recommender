import type { AuthChangeEvent, AuthError, Session, Subscription } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Service-level error codes. The UI maps these to the user-facing copy in PRD
// §4.5, keeping wording out of the service (and easier to localize later).
export type AuthErrorCode =
  | 'invalid_credentials' // wrong email/password
  | 'email_exists' // sign-up against an already-registered email
  | 'email_not_confirmed' // sign-in before verifying
  | 'oauth_failed' // OAuth could not be initiated
  | 'rate_limited' // too many auth/email requests (HTTP 429)
  | 'network' // fetch failed / offline
  | 'unknown'

export interface AuthResult {
  error: AuthErrorCode | null
}

export interface SignUpResult extends AuthResult {
  // True when a fresh account was created and a verification email was sent.
  needsVerification?: boolean
}

// Verification + OAuth links must return the user to this origin so the
// Supabase client can complete the session (detectSessionInUrl).
function redirectTo(): string {
  return window.location.origin
}

function mapError(error: AuthError): AuthErrorCode {
  const code = error.code ?? ''
  const msg = error.message?.toLowerCase() ?? ''

  if (error.status === 429 || code.includes('rate_limit') || msg.includes('rate limit')) {
    return 'rate_limited'
  }
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'email_not_confirmed'
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'invalid_credentials'
  if (msg.includes('already registered') || msg.includes('already exists')) return 'email_exists'
  return 'unknown'
}

// Supabase throws (rather than returning `{ error }`) on transport failures.
function isNetworkError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? ''
  const msg = ((err as { message?: string })?.message ?? '').toLowerCase()
  return (
    name === 'AuthRetryableFetchError' ||
    err instanceof TypeError || // fetch network failure surfaces as TypeError
    msg.includes('failed to fetch') ||
    msg.includes('network')
  )
}

export const authService = {
  async signUp(email: string, password: string): Promise<SignUpResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      })
      if (error) return { error: mapError(error) }
      // Supabase obfuscates duplicate sign-ups (to prevent email enumeration) by
      // returning a user with an empty identities array instead of an error.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { error: 'email_exists' }
      }
      return { error: null, needsVerification: true }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'unknown' }
    }
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: mapError(error) }
      return { error: null }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'unknown' }
    }
  },

  // Redirects the browser to Google; on success the user returns to the app and
  // the session is completed via detectSessionInUrl. Only initiation can fail here.
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() },
      })
      if (error) return { error: 'oauth_failed' }
      return { error: null }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'oauth_failed' }
    }
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },

  // Delete the signed-in user's account (PRD §4.7). The browser SDK can't delete
  // auth users — that needs elevated privileges — so this calls the
  // `delete-account` Edge Function, which deletes the auth user with the service
  // role; FK cascades remove user_profiles + saved_loadouts. The caller then
  // clears local data and signs out. Returns error=true on any failure.
  async deleteAccount(): Promise<{ error: boolean }> {
    try {
      const { error } = await supabase.functions.invoke('delete-account')
      return { error: !!error }
    } catch {
      return { error: true }
    }
  },

  async resendVerificationEmail(email: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo() },
      })
      if (error) return { error: mapError(error) }
      return { error: null }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'unknown' }
    }
  },

  // Built-in Supabase email reset flow (PRD §4.3 forgot-password link). Sends a
  // recovery link; clicking it fires a PASSWORD_RECOVERY auth event back in the
  // app, which the UI handles by prompting for a new password (see updatePassword).
  async sendPasswordReset(email: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo(),
      })
      if (error) return { error: mapError(error) }
      return { error: null }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'unknown' }
    }
  },

  // Sets a new password for the currently-authenticated user. Used to complete
  // the recovery flow after a PASSWORD_RECOVERY event.
  async updatePassword(newPassword: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { error: mapError(error) }
      return { error: null }
    } catch (err) {
      return { error: isNetworkError(err) ? 'network' : 'unknown' }
    }
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  // Returns the subscription so callers can unsubscribe on unmount. The event is
  // forwarded so callers can react to PASSWORD_RECOVERY specifically.
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): Subscription {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
    return data.subscription
  },
}
