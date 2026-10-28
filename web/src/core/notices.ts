import type { AutoFlag } from './mistakeDetector'
import type { DayCheckIn, JournalProfile, Trade, WeeklyReview } from './models'
import { dayLimits } from './limits'
import { defaultReviewWeek } from './review'
import { localDayKey, type WeekStart } from './stats'

// The bell in the top bar (SPEC section 3): what deserves the trader's attention right now,
// worked out from the journal. Nothing is stored but which notices were seen; each id names its
// day or week, so a notice comes back fresh the next time it applies.

export type NoticeKind = 'limitReached' | 'limitWarning' | 'revenge' | 'reviewDue' | 'checkIn'

export interface Notice {
  id: string
  kind: NoticeKind
  /** For `revenge`: how many of today's trades were flagged. */
  count?: number
}

export interface NoticeInput {
  trades: readonly Trade[]
  profile: JournalProfile
  reviews: readonly WeeklyReview[]
  checkins: readonly DayCheckIn[]
  autoFlags: ReadonlyMap<string, readonly AutoFlag[]>
  now: Date
  weekStart: WeekStart
}

/** Today's notices, most urgent first. */
export function notices({ trades, profile, reviews, checkins, autoFlags, now, weekStart }: NoticeInput): Notice[] {
  const day = localDayKey(now)
  const list: Notice[] = []

  const limits = dayLimits(trades, profile, now)
  if (limits.reached) list.push({ id: `limitReached-${day}`, kind: 'limitReached' })
  else if (limits.loss?.level === 'warning' || limits.trades?.level === 'warning') list.push({ id: `limitWarning-${day}`, kind: 'limitWarning' })

  const revenge = trades.filter(
    (trade) => localDayKey(new Date(trade.openedAt)) === day && (autoFlags.get(trade.id) ?? []).some((flag) => flag.key === 'revengeTrading') && !trade.dismissedFlags?.includes('revengeTrading'),
  ).length
  if (revenge > 0) list.push({ id: `revenge-${day}-${revenge}`, kind: 'revenge', count: revenge })

  const reviewWeek = localDayKey(defaultReviewWeek(now, weekStart))
  if (now.getDay() === profile.reviewWeekday && !reviews.some((review) => review.weekStart === reviewWeek)) list.push({ id: `reviewDue-${reviewWeek}`, kind: 'reviewDue' })

  if (!checkins.some((checkin) => checkin.date === day)) list.push({ id: `checkIn-${day}`, kind: 'checkIn' })

  return list
}

/** Seen ids after opening the bell: the notices showing now (older ids are dropped, so the list stays short). */
export function markSeen(current: readonly Notice[]): string[] {
  return current.map((notice) => notice.id)
}

export function unseenCount(seen: readonly string[], current: readonly Notice[]): number {
  return current.filter((notice) => !seen.includes(notice.id)).length
}
