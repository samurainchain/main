import { describe, expect, it } from 'vitest'
import type { Account, AssetClass } from '../../core/models'
import { tradePnl } from '../../core/pnl'
import { parseScreenshotText } from '../../core/ocr/parseScreenshot'
import { applyScreenshot, buildTrade, editEntryForm, newEntryForm, previewResult, selectContract, type EntryForm } from './entryForm'

const NOW = new Date(2026, 9, 27, 15, 30)

function account(assetClass: AssetClass): Account {
  return {
    id: `acc-${assetClass}`,
    name: assetClass,
    assetClass,
    venue: '',
    currency: 'USD',
    colorHex: '#7C6CFF',
    sortOrder: 0,
    isArchived: false,
    createdAt: NOW.toISOString(),
  }
}

function form(assetClass: AssetClass, overrides: Partial<EntryForm>): EntryForm {
  return { ...newEntryForm(account(assetClass), [], NOW), ...overrides }
}

describe('buildTrade', () => {
  it('requires pair, entry, exit and size only', () => {
    const result = buildTrade(form('stock', {}), account('stock'), undefined, NOW)
    expect(result.errors).toEqual({
      symbol: 'entry.error.symbol',
      entryPrice: 'entry.error.price',
      exitPrice: 'entry.error.price',
      size: 'entry.error.size',
    })
  })

  it('saves a minimal stock trade with defaults', () => {
    const result = buildTrade(
      form('stock', { symbol: ' aapl ', entryPrice: '187,25', exitPrice: '190.1', size: '100' }),
      account('stock'),
      undefined,
      NOW,
    )
    expect(result.errors).toBeUndefined()
    expect(result.trade).toMatchObject({
      symbol: 'AAPL',
      market: 'stock',
      entryPrice: '187.25',
      quantity: '100',
      contractMultiplier: '1',
      fees: '0',
      leverage: undefined,
      source: 'manual',
    })
    expect(tradePnl(result.trade!)?.toString()).toBe('285')
  })

  it('applies the preset multiplier to futures', () => {
    const futures = selectContract(form('futures', { entryPrice: '5000', exitPrice: '5010', size: '2', side: 'short' }), 'MES')
    const { trade } = buildTrade(futures, account('futures'), undefined, NOW)
    expect(trade?.symbol).toBe('MES')
    expect(trade?.contractMultiplier).toBe('5')
    expect(tradePnl(trade!)?.toString()).toBe('-100')
  })

  it('needs a multiplier for a custom futures contract', () => {
    const custom = selectContract(form('futures', { entryPrice: '1', exitPrice: '2', size: '1' }), 'custom')
    expect(buildTrade({ ...custom, symbol: 'ZB' }, account('futures'), undefined, NOW).errors).toEqual({ multiplier: 'entry.error.multiplier' })
    const { trade } = buildTrade({ ...custom, symbol: 'ZB', multiplier: '1000' }, account('futures'), undefined, NOW)
    expect(trade?.contractMultiplier).toBe('1000')
  })

  it('converts a USDT position size into coins', () => {
    const { trade } = buildTrade(
      form('cryptoPerp', { symbol: 'BTCUSDT', entryPrice: '60000', exitPrice: '61200', size: '1500', sizeUnit: 'quote', leverage: 20 }),
      account('cryptoPerp'),
      undefined,
      NOW,
    )
    expect(trade?.quantity).toBe('0.025')
    expect(trade?.leverage).toBe('20')
    expect(tradePnl(trade!)?.toString()).toBe('30')
  })

  it('keeps leverage only for perpetuals', () => {
    const { trade } = buildTrade(form('cryptoSpot', { symbol: 'ETHUSDT', entryPrice: '3000', exitPrice: '3100', size: '1' }), account('cryptoSpot'), undefined, NOW)
    expect(trade?.leverage).toBeUndefined()
  })

  it('rejects an exit before the entry', () => {
    const result = buildTrade(
      form('stock', { symbol: 'TSLA', entryPrice: '1', exitPrice: '2', size: '1', openedAt: '2026-10-27T15:00', closedAt: '2026-10-27T14:00' }),
      account('stock'),
      undefined,
      NOW,
    )
    expect(result.errors).toEqual({ closedAt: 'entry.error.closedBeforeOpened' })
  })

  it('fixes the stop at entry on create and only moves the latest stop on edit', () => {
    const created = buildTrade(
      form('stock', { symbol: 'NVDA', entryPrice: '100', exitPrice: '110', size: '10', stopLoss: '95' }),
      account('stock'),
      undefined,
      NOW,
    ).trade!
    expect(created.initialStopLoss).toBe('95')

    const edited = buildTrade({ ...editEntryForm(created), stopLoss: '102' }, account('stock'), created, NOW).trade!
    expect(edited.id).toBe(created.id)
    expect(edited.createdAt).toBe(created.createdAt)
    expect(edited.initialStopLoss).toBe('95')
    expect(edited.stopLoss).toBe('102')
  })

  it('round-trips a futures trade through the edit form', () => {
    const created = buildTrade(
      selectContract(form('futures', { entryPrice: '78.4', exitPrice: '78.15', size: '1' }), 'CL'),
      account('futures'),
      undefined,
      NOW,
    ).trade!
    const reopened = editEntryForm(created)
    expect(reopened.contract).toBe('CL')
    expect(reopened.multiplier).toBe('1000')
  })
})

describe('previewResult', () => {
  it('shows PnL and R as soon as prices and size are valid', () => {
    const preview = previewResult(form('stock', { entryPrice: '100', exitPrice: '106', size: '10', stopLoss: '97' }), 'stock')
    expect(preview.pnl?.toString()).toBe('60')
    expect(preview.r?.toString()).toBe('2')
  })

  it('stays empty while the form is incomplete', () => {
    expect(previewResult(form('stock', { entryPrice: '100' }), 'stock')).toEqual({})
  })
})

describe('applyScreenshot', () => {
  const parsed = parseScreenshotText(`BTCUSDT Perpetual
Short 20x
Entry Price 60,000.0
Avg. Close Price 59,400.0
Closed Vol. 0.100 BTC
Closing PNL +60.00 USDT`)

  it('fills recognized fields, marks them and saves the trade as OCR', () => {
    const { form: filled, recognized } = applyScreenshot(form('cryptoPerp', { note: 'kept' }), parsed, 'cryptoPerp')
    expect(filled).toMatchObject({ symbol: 'BTCUSDT', side: 'short', entryPrice: '60000.0', exitPrice: '59400.0', size: '0.100', leverage: 20, note: 'kept' })
    expect(recognized).toEqual({ symbol: 'high', side: 'high', entryPrice: 'high', exitPrice: 'high', size: 'high', leverage: 'high' })
    const { trade } = buildTrade(filled, account('cryptoPerp'), undefined, NOW)
    expect(trade?.source).toBe('ocr')
    expect(trade?.quantity).toBe('0.100')
  })

  it('picks the futures preset for a known contract symbol', () => {
    const { form: filled } = applyScreenshot(form('futures', {}), parseScreenshotText('CME_MINI:NQ1! Long'), 'futures')
    expect(filled.contract).toBe('NQ')
    expect(filled.multiplier).toBe('20')
  })

  it('switches the size unit when the screenshot gives a USDT size', () => {
    const quote = parseScreenshotText('ETH-USDT-SWAP Long\nPosition size 1,500 USDT')
    expect(applyScreenshot(form('cryptoPerp', {}), quote, 'cryptoPerp').form.sizeUnit).toBe('quote')
  })
})
