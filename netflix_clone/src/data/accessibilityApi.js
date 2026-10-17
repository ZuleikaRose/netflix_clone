import { defaultA11y } from '../state/accessibilityContext.js'

// Accessibility menu settings ↔ the accessibility_settings table (one row per member). Column names are the
// setting names in snake_case: textSize ↔ text_size, highlightLinks ↔ highlight_links…
const column = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const keys = Object.keys(defaultA11y)

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// The member's saved settings, or null if they haven't saved any yet
export async function loadAccessibility(supabase, userId) {
  const row = await supabase.from('accessibility_settings').select(keys.map(column).join(', '))
    .eq('user_id', userId).maybeSingle().then(unwrap)
  return row && Object.fromEntries(keys.map((key) => [key, row[column(key)]]))
}

export const saveAccessibility = (supabase, userId, settings) => supabase.from('accessibility_settings').upsert(
  { user_id: userId, ...Object.fromEntries(keys.map((key) => [column(key), settings[key]])), updated_at: new Date().toISOString() },
  { onConflict: 'user_id' },
).then(unwrap)
