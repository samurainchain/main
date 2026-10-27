import type { AssetClass } from './models'

export interface FuturesContractPreset {
  symbol: string
  name: string
  /** Dollar value of a one-point move for one contract. */
  multiplier: string
}

/** Futures contracts with their value per point (SPEC section 5). */
export const FUTURES_PRESETS: readonly FuturesContractPreset[] = [
  { symbol: 'ES', name: 'E-mini S&P 500', multiplier: '50' },
  { symbol: 'MES', name: 'Micro E-mini S&P 500', multiplier: '5' },
  { symbol: 'NQ', name: 'E-mini Nasdaq-100', multiplier: '20' },
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', multiplier: '2' },
  { symbol: 'YM', name: 'E-mini Dow', multiplier: '5' },
  { symbol: 'RTY', name: 'E-mini Russell 2000', multiplier: '50' },
  { symbol: 'CL', name: 'Crude Oil', multiplier: '1000' },
  { symbol: 'GC', name: 'Gold', multiplier: '100' },
  { symbol: 'MGC', name: 'Micro Gold', multiplier: '10' },
  { symbol: 'SI', name: 'Silver', multiplier: '5000' },
]

/** Symbol suggestions per market for the entry form (SPEC section 4.4). */
export const SYMBOL_SUGGESTIONS: Record<AssetClass, readonly string[]> = {
  cryptoSpot: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'],
  cryptoPerp: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'],
  stock: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'SPY', 'QQQ'],
  futures: FUTURES_PRESETS.map((preset) => preset.symbol),
}
