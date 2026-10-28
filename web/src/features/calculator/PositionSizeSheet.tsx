import { useId, useState, type ReactNode } from 'react'
import { activeAccounts, useJournal, useSelectedAccount } from '../../app/journal'
import { updateSettings, useSettings } from '../../app/settings'
import { useSheets } from '../../app/sheets'
import type { Account } from '../../core/models'
import { positionSize, type RiskMode } from '../../core/positionSize'
import { FUTURES_PRESETS } from '../../core/presets'
import { Button, Card, Field, PnLText, Segmented, Sheet } from '../../design/components'
import { formatDecimal, formatMoney, formatPercent } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { CUSTOM_CONTRACT } from '../entry/entryForm'
import { DecimalInput } from '../entry/TradeEntrySheet'

const DEFAULT_LEVERAGE = '10'

/**
 * How big a position to take (SPEC section 4.4): balance and risk in, size out, so a stop-out
 * costs exactly the chosen risk. The result can go straight into a new trade.
 */
export function PositionSizeSheet() {
  const { sheet, close } = useSheets()
  return sheet.kind === 'calculator' ? <CalculatorContent onClose={close} /> : null
}

function CalculatorContent({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n()
  const { accounts } = useJournal()
  const selected = useSelectedAccount()
  const { newTradeFrom } = useSheets()
  const saved = useSettings().calculatorRisk
  const active = activeAccounts(accounts)
  const ids = { account: useId(), balance: useId(), risk: useId(), contract: useId(), multiplier: useId(), entry: useId(), stop: useId(), target: useId(), leverage: useId() }

  const [accountId, setAccountId] = useState((selected ?? active[0])?.id ?? '')
  const account: Account | undefined = active.find((item) => item.id === accountId)
  const market = account?.assetClass ?? 'cryptoPerp'
  const currency = account?.currency ?? 'USD'
  const [balance, setBalance] = useState(account?.depositAmount ?? '')
  const [riskMode, setRiskMode] = useState<RiskMode>(saved?.mode ?? 'percent')
  const [risk, setRisk] = useState(saved?.value ?? '1')
  const [contract, setContract] = useState(FUTURES_PRESETS[0]!.symbol)
  const [customMultiplier, setCustomMultiplier] = useState('')
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [leverage, setLeverage] = useState(DEFAULT_LEVERAGE)

  const preset = FUTURES_PRESETS.find((item) => item.symbol === contract)
  const multiplier = market === 'futures' ? (preset?.multiplier ?? customMultiplier) : '1'
  const filled = [balance, risk, entry, stop].every((value) => value.trim() !== '')
  const outcome = filled ? positionSize({ market, balance, riskMode, risk, entry, stop, multiplier, takeProfit, leverage }) : undefined
  const result = outcome && 'result' in outcome ? outcome.result : undefined
  const money = (amount: Parameters<typeof formatMoney>[0]) => formatMoney(amount, currency, locale, false)
  const sizeLabel = t(market === 'futures' ? 'entry.contracts' : market === 'stock' ? 'entry.shares' : 'entry.quantity')

  const changeAccount = (id: string) => {
    setAccountId(id)
    const next = active.find((item) => item.id === id)
    if (next?.depositAmount) setBalance(next.depositAmount)
  }

  const rememberRisk = (mode: RiskMode, value: string) => updateSettings({ calculatorRisk: { mode, value } })

  const logTrade = () => {
    if (!result) return
    newTradeFrom({
      accountId: account?.id,
      side: result.side,
      entryPrice: entry.trim(),
      stopLoss: stop.trim(),
      size: result.quantity.toString(),
      ...(market === 'futures' ? { contract: preset ? contract : CUSTOM_CONTRACT, multiplier, symbol: preset?.symbol } : {}),
      ...(market === 'cryptoPerp' && Number(leverage) > 0 ? { leverage: Number(leverage) } : {}),
    })
  }

  return (
    <Sheet
      open
      title={t('calc.title')}
      onClose={onClose}
      footer={
        <div className="action-row action-row--wrap">
          <Button onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" disabled={!result} onClick={logTrade}>
            {t('calc.logTrade')}
          </Button>
        </div>
      }
    >
      <div className="form-stack">
        {active.length > 1 && (
          <Field label={t('entry.account')} htmlFor={ids.account}>
            <select id={ids.account} className="input" value={accountId} onChange={(event) => changeAccount(event.target.value)}>
              {active.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t(`market.${item.assetClass}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-grid">
          <Field label={t('calc.balance')} htmlFor={ids.balance}>
            <DecimalInput id={ids.balance} value={balance} onChange={setBalance} />
          </Field>
          <Field label={t('calc.risk')} htmlFor={ids.risk}>
            <div className="input-with-addon">
              <DecimalInput
                id={ids.risk}
                value={risk}
                onChange={(value) => {
                  setRisk(value)
                  rememberRisk(riskMode, value)
                }}
              />
              <Segmented
                label={t('calc.riskMode')}
                value={riskMode}
                onChange={(mode) => {
                  setRiskMode(mode)
                  rememberRisk(mode, risk)
                }}
                options={[
                  { value: 'percent', label: '%' },
                  { value: 'amount', label: currency === 'USDT' ? 'USDT' : '$' },
                ]}
              />
            </div>
          </Field>
        </div>
        {market === 'futures' && (
          <div className="form-grid">
            <Field label={t('entry.contract')} htmlFor={ids.contract}>
              <select id={ids.contract} className="input" value={contract} onChange={(event) => setContract(event.target.value)}>
                {FUTURES_PRESETS.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol} · {item.name}
                  </option>
                ))}
                <option value={CUSTOM_CONTRACT}>{t('entry.customContract')}</option>
              </select>
            </Field>
            {!preset && (
              <Field label={t('entry.multiplier')} htmlFor={ids.multiplier}>
                <DecimalInput id={ids.multiplier} value={customMultiplier} onChange={setCustomMultiplier} />
              </Field>
            )}
          </div>
        )}
        <div className="form-grid">
          <Field label={t('entry.entryPrice')} htmlFor={ids.entry}>
            <DecimalInput id={ids.entry} value={entry} onChange={setEntry} />
          </Field>
          <Field label={t('entry.stopLoss')} htmlFor={ids.stop}>
            <DecimalInput id={ids.stop} value={stop} onChange={setStop} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label={t('calc.takeProfit')} htmlFor={ids.target}>
            <DecimalInput id={ids.target} value={takeProfit} onChange={setTakeProfit} />
          </Field>
          {market === 'cryptoPerp' && (
            <Field label={t('entry.leverage')} htmlFor={ids.leverage}>
              <DecimalInput id={ids.leverage} value={leverage} onChange={setLeverage} />
            </Field>
          )}
        </div>

        <Card className="calc-result">
          <div aria-live="polite">
            {result ? (
              <>
                <p className="label">{sizeLabel}</p>
                <p className="calc-result__size numeric">
                  {formatDecimal(result.quantity.toString(), locale)}{' '}
                  <span className={`side-badge side-badge--${result.side}`}>{t(`side.${result.side}`)}</span>
                </p>
                <dl className="detail-list">
                  <Row label={t('calc.result.risk')}>
                    <PnLText amount={result.risk.times(-1)} currency={currency} />
                    <span className="caption"> · {t('calc.result.riskOfBalance', { percent: formatPercent(result.riskPercent, locale).replace(/^\+/, '') })}</span>
                  </Row>
                  <Row label={t('calc.result.stop')}>
                    {formatDecimal(result.stopDistance.toString(), locale)} · {formatPercent(result.stopPercent, locale).replace(/^\+/, '')}
                  </Row>
                  <Row label={t('calc.result.notional')}>{money(result.notional)}</Row>
                  {result.margin && <Row label={t('calc.result.margin', { leverage: formatDecimal(leverage.trim().replace(',', '.'), locale) })}>{money(result.margin)}</Row>}
                  {result.reward && (
                    <Row label={t('calc.result.reward')}>
                      <PnLText amount={result.reward} currency={currency} />
                    </Row>
                  )}
                  {result.rewardRisk && <Row label={t('calc.result.rewardRisk')}>{`${formatDecimal(result.rewardRisk.round(2).toString(), locale)} : 1`}</Row>}
                </dl>
              </>
            ) : (
              <p className={outcome ? 'field__error' : 'secondary-text'}>{outcome && 'error' in outcome ? t(`calc.error.${outcome.error}`) : t('calc.fillIn')}</p>
            )}
          </div>
        </Card>
        <p className="caption">{t('calc.note')}</p>
      </div>
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-list__row">
      <dt className="secondary-text">{label}</dt>
      <dd className="numeric">{children}</dd>
    </div>
  )
}
