// The Supabase project the journal syncs to. Both values are public by design: they ship in
// the site's code, and row-level security (supabase/schema.sql) keeps each user's rows private.
// Never put the service_role key here.

export const SUPABASE_URL = 'https://vmjyzwrrueoyxcuzpeil.supabase.co'
/** Project Settings → API Keys → anon / publishable key. Empty turns cloud sync off. */
export const SUPABASE_ANON_KEY = 'sb_publishable_ZcBAXWYsQxUDhWMk_2mmkQ_DtuQzzJh'
