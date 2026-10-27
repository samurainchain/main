import type { SupabaseClient } from '@supabase/supabase-js'

// Feedback for future updates: one row per message in the feedback table (schema.sql). Anyone
// can send, signed in or not; nobody can read the table from the app, only the project owner
// in the Supabase dashboard.

export type FeedbackKind = 'idea' | 'problem' | 'other'
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['idea', 'problem', 'other']
export const FEEDBACK_MAX_LENGTH = 4000

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  /** Where to reply; the signed-in email, or one typed in when signed out. */
  email?: string
  locale: string
  /** The screen it was sent from, e.g. "analytics". */
  page: string
}

export interface FeedbackRow {
  kind: FeedbackKind
  message: string
  email: string | null
  locale: string
  page: string
}

/** The row to insert, or undefined when there is nothing to send. */
export function feedbackRow(input: FeedbackInput): FeedbackRow | undefined {
  const message = input.message.trim()
  if (!message) return undefined
  const email = input.email?.trim()
  return {
    kind: input.kind,
    message: message.slice(0, FEEDBACK_MAX_LENGTH),
    email: email && email.includes('@') ? email.slice(0, 320) : null,
    locale: input.locale.slice(0, 10),
    page: input.page.slice(0, 64),
  }
}

export async function sendFeedback(client: SupabaseClient, row: FeedbackRow): Promise<void> {
  const { error } = await client.from('feedback').insert(row)
  if (error) throw error
}
