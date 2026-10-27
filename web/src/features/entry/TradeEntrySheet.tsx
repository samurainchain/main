import Big from 'big.js'
import { ImageUp, Plus, Wallet } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { activeAccounts, useJournal, useMistakeName, useSelectedAccount, useStore } from '../../app/journal'
import { useSheets } from '../../app/sheets'
import { EMOTIONS, type Account, type Trade } from '../../core/models'
import { FUTURES_PRESETS, SYMBOL_SUGGESTIONS } from '../../core/presets'
import { Button, Chip, EmptyState, Field, PnLText, Segmented, Sheet } from '../../design/components'
import { formatMoney, formatR } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import type { MessageKey } from '../../i18n/messages/en'
import { EMOTION_ICONS } from '../trades/TradeRow'
import { recognizeScreenshot } from './recognize'
import {
  applyScreenshot,
  buildTrade,
  CUSTOM_CONTRACT,
  editEntryForm,
  isCrypto,
  newEntryForm,
  previewResult,
  selectContract,
  type EntryErrors,
  type EntryForm,
  type RecognizedFields,
} from './entryForm'

/** Quick trade entry (SPEC section 4.4): one sheet for new and edited trades. */
export function TradeEntrySheet() {
  const { sheet, close } = useSheets()
  const { trades } = useJournal()
  const open = sheet.kind === 'trade'
  const existing = open && sheet.tradeId ? trades.find((trade) => trade.id === sheet.tradeId) : undefined
  // Remount the form for every opening so it starts from fresh state.
  const formKey = open ? (sheet.tradeId ?? `new-${trades.length}`) : 'closed'
  return open ? <EntrySheetContent key={formKey} existing={existing} onClose={close} /> : null
}

function EntrySheetContent({ existing, onClose }: { existing: Trade | undefined; onClose: () => void }) {
  const { t, locale } = useI18n()
  const store = useStore()
  const { accounts, trades, mistakes, setups, rules } = useJournal()
  const { newAccount } = useSheets()
  const selected = useSelectedAccount()
  const mistakeName = useMistakeName()
  const ids = { symbol: useId(), symbols: useId(), entry: useId(), exit: useId(), size: useId(), stop: useId(), fees: useId(), opened: useId(), closed: useId(), note: useId(), account: useId(), contract: useId(), multiplier: useId(), leverage: useId() }

  const active = activeAccounts(accounts)
  const defaultAccount = selected ?? active[0]
  const [form, setForm] = useState<EntryForm>(() => (existing ? editEntryForm(existing) : newEntryForm(defaultAccount, trades)))
  const [errors, setErrors] = useState<EntryErrors>({})
  const [showMore, setShowMore] = useState(Boolean(existing && (existing.fees !== '0' || existing.note)))
  const [saving, setSaving] = useState(false)
  const [recognized, setRecognized] = useState<RecognizedFields>({})
  const [ocr, setOcr] = useState<{ state: 'idle' | 'running' | 'done' | 'empty' | 'error'; progress: number }>({ state: 'idle', progress: 0 })
  const screenshotInput = useRef<HTMLInputElement>(null)

  const account = accounts.find((item) => item.id === form.accountId) ?? defaultAccount
  const market = existing?.market ?? account?.assetClass ?? 'cryptoSpot'
  // An edited trade can only move between accounts of the same market.
  const accountChoices = existing ? accounts.filter((item) => item.assetClass === existing.market) : active
  const preview = previewResult(form, market)

  const symbolSuggestions = useMemo(() => {
    const recent = [...trades]
      .filter((trade) => trade.market === market)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((trade) => trade.symbol)
    return [...new Set([...recent, ...SYMBOL_SUGGESTIONS[market]])]
  }, [trades, market])

  const update = (patch: Partial<EntryForm>) => setForm((current) => ({ ...current, ...patch }))
  /** An edit by hand: the field no longer needs the "recognized" highlight. */
  const edit = (field: keyof RecognizedFields, patch: Partial<EntryForm>) => {
    update(patch)
    setRecognized(({ [field]: _removed, ...rest }) => rest)
  }

  const readScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setOcr({ state: 'running', progress: 0 })
    try {
      const parsed = await recognizeScreenshot(file, (progress) => setOcr({ state: 'running', progress }))
      const applied = applyScreenshot(form, parsed, market)
      if (Object.keys(applied.recognized).length === 0) return setOcr({ state: 'empty', progress: 1 })
      setForm(applied.form)
      setRecognized(applied.recognized)
      setErrors({})
      setOcr({ state: 'done', progress: 1 })
    } catch (error) {
      console.error('Screenshot recognition failed', error)
      setOcr({ state: 'error', progress: 0 })
    }
  }
  const error = (field: keyof EntryErrors) => (errors[field] ? t(errors[field]) : undefined)
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  const changeAccount = (accountId: string) => {
    const next = accounts.find((item) => item.id === accountId)
    if (!next) return
    if (next.assetClass === market) return update({ accountId })
    // A different market needs different fields, so start the market-specific part over.
    const fresh = newEntryForm(next, trades)
    update({ accountId, symbol: fresh.symbol, contract: fresh.contract, multiplier: fresh.multiplier, leverage: fresh.leverage, sizeUnit: 'base' })
  }

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!account || saving) return
    const result = buildTrade(form, account, existing)
    if (result.errors) {
      setErrors(result.errors)
      if (result.errors.fees || result.errors.closedAt) setShowMore(true)
      return
    }
    setSaving(true)
    try {
      await store.saveTrade(result.trade)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save()
  }

  const title = existing ? t('entry.editTitle') : t('entry.newTitle')

  if (!account) {
    return (
      <Sheet open title={title} onClose={onClose}>
        <EmptyState
          icon={<Wallet size={28} />}
          title={t('today.noAccountTitle')}
          message={t('entry.noAccountMessage')}
          action={
            <Button variant="primary" block onClick={newAccount}>
              {t('accounts.create')}
            </Button>
          }
        />
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      title={title}
      onClose={onClose}
      header={
        <div className="entry-preview" aria-live="polite">
          {preview.pnl ? (
            <>
              <PnLText amount={preview.pnl} currency={account.currency} size="hero" />
              {preview.r && <span className="numeric secondary-text">{formatR(preview.r, locale)}</span>}
            </>
          ) : (
            <span className="secondary-text">{t('entry.previewHint')}</span>
          )}
        </div>
      }
      footer={
        <Button variant="primary" block type="submit" form="trade-entry" disabled={saving}>
          {t('action.save')}
        </Button>
      }
    >
      <form id="trade-entry" className="form-stack" onSubmit={save} onKeyDown={onKeyDown} noValidate>
        {!existing && (
          <div className="screenshot-start">
            <Button
              icon={<ImageUp size={18} aria-hidden="true" />}
              disabled={ocr.state === 'running'}
              onClick={() => screenshotInput.current?.click()}
            >
              {t('entry.fromScreenshot')}
            </Button>
            <input ref={screenshotInput} type="file" accept="image/*" hidden onChange={readScreenshot} />
            <p className="caption" role="status" aria-live="polite">
              {ocr.state === 'running'
                ? t('entry.ocrRunning', { percent: Math.round(ocr.progress * 100) })
                : ocr.state === 'done'
                  ? t('entry.ocrDone')
                  : ocr.state === 'empty'
                    ? t('entry.ocrEmpty')
                    : ocr.state === 'error'
                      ? t('entry.ocrError')
                      : t('entry.ocrHint')}
            </p>
          </div>
        )}
        {accountChoices.length > 1 && (
          <Field label={t('entry.account')} htmlFor={ids.account}>
            <select id={ids.account} className="input" value={account.id} onChange={(event) => changeAccount(event.target.value)}>
              {accountChoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t(`market.${item.assetClass}`)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {market === 'futures' ? (
          <div className="form-grid">
            <Field label={t('entry.contract')} htmlFor={ids.contract}>
              <select id={ids.contract} className="input" value={form.contract} onChange={(event) => setForm(selectContract(form, event.target.value))}>
                {FUTURES_PRESETS.map((preset) => (
                  <option key={preset.symbol} value={preset.symbol}>
                    {preset.symbol} · {preset.name}
                  </option>
                ))}
                <option value={CUSTOM_CONTRACT}>{t('entry.customContract')}</option>
              </select>
            </Field>
            {form.contract === CUSTOM_CONTRACT ? (
              <>
                <Field label={t('entry.symbol')} htmlFor={ids.symbol} error={error('symbol')} recognized={recognized.symbol}>
                  <input id={ids.symbol} className="input" value={form.symbol} autoCapitalize="characters" autoComplete="off" onChange={(event) => edit('symbol', { symbol: event.target.value })} />
                </Field>
                <Field label={t('entry.multiplier')} htmlFor={ids.multiplier} error={error('multiplier')} hint={t('entry.multiplierHint')}>
                  <DecimalInput id={ids.multiplier} value={form.multiplier} onChange={(multiplier) => update({ multiplier })} />
                </Field>
              </>
            ) : (
              <Field label={t('entry.multiplier')}>
                <p className="input input--readonly numeric">{formatMoney(new Big(form.multiplier), 'USD', locale, false)}</p>
              </Field>
            )}
          </div>
        ) : (
          <Field label={t('entry.symbol')} htmlFor={ids.symbol} error={error('symbol')} recognized={recognized.symbol}>
            <input
              id={ids.symbol}
              className="input"
              list={ids.symbols}
              value={form.symbol}
              placeholder={SYMBOL_SUGGESTIONS[market][0]}
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus={!existing}
              onChange={(event) => edit('symbol', { symbol: event.target.value })}
            />
            <datalist id={ids.symbols}>
              {symbolSuggestions.map((symbol) => (
                <option key={symbol} value={symbol} />
              ))}
            </datalist>
          </Field>
        )}

        <Segmented
          label={t('entry.side')}
          size="large"
          value={form.side}
          onChange={(side) => edit('side', { side })}
          options={[
            { value: 'long', label: t('side.long'), tone: 'profit' },
            { value: 'short', label: t('side.short'), tone: 'loss' },
          ]}
        />

        {market === 'cryptoPerp' && (
          <Field label={`${t('entry.leverage')}: ${form.leverage}×`} htmlFor={ids.leverage} recognized={recognized.leverage}>
            <input
              id={ids.leverage}
              className="slider"
              type="range"
              min={1}
              max={125}
              step={1}
              value={form.leverage}
              onChange={(event) => edit('leverage', { leverage: Number(event.target.value) })}
            />
          </Field>
        )}

        <div className="form-grid">
          <Field label={t('entry.entryPrice')} htmlFor={ids.entry} error={error('entryPrice')} recognized={recognized.entryPrice}>
            <DecimalInput id={ids.entry} value={form.entryPrice} onChange={(entryPrice) => edit('entryPrice', { entryPrice })} />
          </Field>
          <Field label={t('entry.exitPrice')} htmlFor={ids.exit} error={error('exitPrice')} recognized={recognized.exitPrice}>
            <DecimalInput id={ids.exit} value={form.exitPrice} onChange={(exitPrice) => edit('exitPrice', { exitPrice })} />
          </Field>
        </div>

        <Field label={t(sizeLabel(market, form.sizeUnit))} htmlFor={ids.size} error={error('size')} recognized={recognized.size}>
          <div className="input-with-addon">
            <DecimalInput id={ids.size} value={form.size} onChange={(size) => edit('size', { size })} />
            {isCrypto(market) && (
              <Segmented
                label={t('entry.sizeUnit')}
                value={form.sizeUnit}
                onChange={(sizeUnit) => update({ sizeUnit })}
                options={[
                  { value: 'base', label: t('entry.unitCoins') },
                  { value: 'quote', label: account.currency },
                ]}
              />
            )}
          </div>
        </Field>

        <Field label={t('entry.stopLoss')} htmlFor={ids.stop} error={error('stopLoss')} hint={t('entry.stopLossHint')}>
          <DecimalInput id={ids.stop} value={form.stopLoss} onChange={(stopLoss) => update({ stopLoss })} />
        </Field>

        <fieldset className="fieldset">
          <legend className="field__label">{t('entry.emotion')}</legend>
          <div className="emotion-picker">
            {EMOTIONS.map((emotion) => {
              const Icon = EMOTION_ICONS[emotion]
              const isSelected = form.emotion === emotion
              return (
                <button
                  key={emotion}
                  type="button"
                  className="emotion-picker__option"
                  aria-pressed={isSelected}
                  onClick={() => update({ emotion: isSelected ? undefined : emotion })}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span>{t(`emotion.${emotion}`)}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field__label">{t('entry.mistakes')}</legend>
          <div className="chip-row">
            {mistakes
              .filter((tag) => !tag.isArchived || form.mistakeIds.includes(tag.id))
              .map((tag) => (
                <Chip
                  key={tag.id}
                  label={mistakeName(tag)}
                  colorHex={tag.colorHex}
                  selected={form.mistakeIds.includes(tag.id)}
                  onToggle={() => update({ mistakeIds: toggle(form.mistakeIds, tag.id) })}
                />
              ))}
            <AddTag
              label={t('entry.addMistake')}
              onAdd={async (name) => {
                const tag = await store.addMistake(name)
                setForm((current) => ({ ...current, mistakeIds: [...current.mistakeIds, tag.id] }))
              }}
            />
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field__label">{t('entry.setups')}</legend>
          <div className="chip-row">
            {setups
              .filter((tag) => !tag.isArchived || form.setupIds.includes(tag.id))
              .map((tag) => (
                <Chip
                  key={tag.id}
                  label={tag.name}
                  colorHex={tag.colorHex}
                  selected={form.setupIds.includes(tag.id)}
                  onToggle={() => update({ setupIds: toggle(form.setupIds, tag.id) })}
                />
              ))}
            <AddTag
              label={t('entry.addSetup')}
              onAdd={async (name) => {
                const tag = await store.addSetup(name)
                setForm((current) => ({ ...current, setupIds: [...current.setupIds, tag.id] }))
              }}
            />
          </div>
        </fieldset>

        {rules.some((rule) => rule.isActive || form.brokenRuleIds.includes(rule.id)) && (
          <fieldset className="fieldset">
            <legend className="field__label">{t('entry.brokenRules')}</legend>
            <div className="chip-row">
              {rules
                .filter((rule) => rule.isActive || form.brokenRuleIds.includes(rule.id))
                .map((rule) => (
                  <Chip
                    key={rule.id}
                    label={rule.text}
                    colorHex="var(--color-loss)"
                    selected={form.brokenRuleIds.includes(rule.id)}
                    onToggle={() => update({ brokenRuleIds: toggle(form.brokenRuleIds, rule.id) })}
                  />
                ))}
            </div>
          </fieldset>
        )}

        <details className="more" open={showMore} onToggle={(event) => setShowMore(event.currentTarget.open)}>
          <summary>{t('entry.more')}</summary>
          <div className="form-stack more__content">
            <Field label={t('entry.fees')} htmlFor={ids.fees} error={error('fees')}>
              <DecimalInput id={ids.fees} value={form.fees} placeholder="0" onChange={(fees) => update({ fees })} />
            </Field>
            <div className="form-grid">
              <Field label={t('entry.openedAt')} htmlFor={ids.opened}>
                <input id={ids.opened} className="input" type="datetime-local" value={form.openedAt} onChange={(event) => update({ openedAt: event.target.value })} />
              </Field>
              <Field label={t('entry.closedAt')} htmlFor={ids.closed} error={error('closedAt')}>
                <input id={ids.closed} className="input" type="datetime-local" value={form.closedAt} onChange={(event) => update({ closedAt: event.target.value })} />
              </Field>
            </div>
            <Field label={t('entry.note')} htmlFor={ids.note}>
              <textarea id={ids.note} className="input" value={form.note} onChange={(event) => update({ note: event.target.value })} />
            </Field>
          </div>
        </details>
      </form>
    </Sheet>
  )
}

function sizeLabel(market: Account['assetClass'], unit: EntryForm['sizeUnit']): MessageKey {
  if (market === 'futures') return 'entry.contracts'
  if (market === 'stock') return 'entry.shares'
  return unit === 'quote' ? 'entry.notional' : 'entry.quantity'
}

function DecimalInput({ id, value, placeholder, onChange }: { id: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <input
      id={id}
      className="input numeric"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/** A "+ Add" chip that turns into a text field for a new tag name. */
function AddTag({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const commit = async () => {
    if (name.trim()) await onAdd(name)
    setName('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button type="button" className="chip chip--add" onClick={() => setEditing(true)}>
        <Plus size={14} aria-hidden="true" />
        {label}
      </button>
    )
  }

  return (
    <input
      className="input chip-input"
      aria-label={label}
      value={name}
      autoFocus
      onChange={(event) => setName(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        } else if (event.key === 'Escape') {
          // Keep Escape from closing the whole sheet.
          event.preventDefault()
          event.stopPropagation()
          setName('')
          setEditing(false)
        }
      }}
    />
  )
}
