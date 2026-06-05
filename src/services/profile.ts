import { supabase } from './supabase'

// App-facing profile shape (camelCase). All text fields optional/nullable.
export interface UserProfile {
  displayName: string | null
  shipName: string | null
  playerTitle: string | null
  hidePaidItems: boolean
}

interface ProfileRow {
  display_name: string | null
  ship_name: string | null
  player_title: string | null
  hide_paid_items: boolean
}

const COLUMNS = 'display_name, ship_name, player_title, hide_paid_items'

function toProfile(row: ProfileRow): UserProfile {
  return {
    displayName: row.display_name,
    shipName: row.ship_name,
    playerTitle: row.player_title,
    hidePaidItems: row.hide_paid_items,
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export const profileService = {
  // RLS scopes this to the caller's own row, so no explicit filter is needed.
  async getProfile(): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(COLUMNS)
      .maybeSingle()
    if (error || !data) return null
    return toProfile(data as ProfileRow)
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<{ error: boolean }> {
    const userId = await currentUserId()
    if (!userId) return { error: true }

    const row: Record<string, unknown> = { user_id: userId }
    if (updates.displayName !== undefined) row.display_name = updates.displayName
    if (updates.shipName !== undefined) row.ship_name = updates.shipName
    if (updates.playerTitle !== undefined) row.player_title = updates.playerTitle
    if (updates.hidePaidItems !== undefined) row.hide_paid_items = updates.hidePaidItems

    // Upsert on user_id so a missing row (e.g. if the signup trigger hasn't run)
    // is created rather than failing the save.
    const { error } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'user_id' })
    return { error: !!error }
  },

  // Convenience read for the engine's paid-items filter (used in Phase 5).
  async getHidePaidItems(): Promise<boolean> {
    const profile = await this.getProfile()
    return profile?.hidePaidItems ?? false
  },
}
