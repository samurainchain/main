import { describe, expect, it } from 'vitest'
import { FEEDBACK_MAX_LENGTH, feedbackRow } from './feedback'

const base = { kind: 'idea' as const, message: 'Add a dark chart theme', locale: 'en', page: 'today' }

describe('feedbackRow', () => {
  it('sends nothing for an empty message', () => {
    expect(feedbackRow({ ...base, message: '   \n ' })).toBeUndefined()
  })

  it('trims the message and keeps it under the limit', () => {
    expect(feedbackRow({ ...base, message: '  hi  ' })?.message).toBe('hi')
    expect(feedbackRow({ ...base, message: 'x'.repeat(FEEDBACK_MAX_LENGTH + 10) })?.message).toHaveLength(FEEDBACK_MAX_LENGTH)
  })

  it('keeps an email only when it looks like one', () => {
    expect(feedbackRow({ ...base, email: ' me@example.com ' })?.email).toBe('me@example.com')
    expect(feedbackRow({ ...base, email: 'nope' })?.email).toBeNull()
    expect(feedbackRow(base)?.email).toBeNull()
  })
})
