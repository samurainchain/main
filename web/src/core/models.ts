// Data model, mirroring SPEC section 5. Money and prices are decimal strings so they keep
// full precision (and the precision the user typed); math goes through big.js in `pnl.ts`.

export type DecimalString = string
/** ISO 8601 timestamp. */
export type Timestamp = string

export const ASSET_CLASSES = ['cryptoSpot', 'cryptoPerp', 'stock', 'futures'] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

export const SIDES = ['long', 'short'] as const
export type Side = (typeof SIDES)[number]

export const EMOTIONS = ['calm', 'confident', 'fomo', 'anger', 'boredom', 'fear', 'greed'] as const
export type Emotion = (typeof EMOTIONS)[number]

export const CURRENCIES = ['USD', 'USDT'] as const
export type Currency = (typeof CURRENCIES)[number]

export type TradeSource = 'manual' | 'ocr' | 'csvImport'

export interface Account {
  id: string
  name: string
  assetClass: AssetClass
  /** Exchange or broker. */
  venue: string
  currency: Currency
  depositAmount?: DecimalString
  colorHex: string
  sortOrder: number
  isArchived: boolean
  createdAt: Timestamp
}

export interface Trade {
  id: string
  accountId: string
  symbol: string
  side: Side
  /** Copied from the account when the trade is created. */
  market: AssetClass
  /** Crypto perpetuals only. */
  leverage?: DecimalString
  entryPrice: DecimalString
  /** Missing means the trade is still open. */
  exitPrice?: DecimalString
  /** In the base asset: coins, shares or contracts. */
  quantity: DecimalString
  /** Value of one point for futures, copied from the preset at entry time; "1" elsewhere. */
  contractMultiplier: DecimalString
  /** Stop at entry; compared with `stopLoss` to tell whether the stop was moved. */
  initialStopLoss?: DecimalString
  /** Latest stop. */
  stopLoss?: DecimalString
  takeProfit?: DecimalString
  /** In the account currency. */
  fees: DecimalString
  openedAt: Timestamp
  closedAt?: Timestamp
  emotion?: Emotion
  mistakeIds: string[]
  setupIds: string[]
  note: string
  source: TradeSource
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface MistakeTag {
  id: string
  /** Empty for a system tag the user hasn't renamed: the UI shows the translated name. */
  name: string
  colorHex: string
  isSystem: boolean
  /** Stable key of a seeded system tag. */
  systemKey?: SystemMistakeKey
  sortOrder: number
  isArchived: boolean
}

export interface SetupTag {
  id: string
  name: string
  colorHex: string
  sortOrder: number
  isArchived: boolean
}

export const SYSTEM_MISTAKES = [
  'fomo',
  'revengeTrading',
  'heldPastStop',
  'highLeverage',
  'overtrading',
  'earlyExit',
  'noStop',
  'offPlan',
] as const
export type SystemMistakeKey = (typeof SYSTEM_MISTAKES)[number]

export interface JournalData {
  accounts: Account[]
  trades: Trade[]
  mistakes: MistakeTag[]
  setups: SetupTag[]
}

export const TAG_COLORS = ['#7C6CFF', '#3DDC97', '#FF5C6C', '#FFB547', '#4FB3FF', '#FF7AC6', '#8E8E99'] as const

export function newId(): string {
  return crypto.randomUUID()
}
