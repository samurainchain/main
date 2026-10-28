import { useId, useState, type FormEvent } from 'react'
import { activeAccounts, useJournal, useStore } from '../../app/journal'
import { useAccess } from '../../app/entitlement'
import { canAddAccount } from '../../core/entitlements'
import { ProLock } from '../billing/ProLock'
import { useSheets } from '../../app/sheets'
import { parsePositive } from '../../core/decimal'
import { ASSET_CLASSES, CURRENCIES, newId, TAG_COLORS, type Account, type AssetClass, type Currency } from '../../core/models'
import { Button, Field, Segmented, Sheet } from '../../design/components'
import { useI18n } from '../../i18n/i18n'

/** Create or edit an account (SPEC section 4.11). */
export function AccountSheet() {
  const { sheet, close } = useSheets()
  const { accounts } = useJournal()
  const access = useAccess()
  if (sheet.kind !== 'account') return null
  const existing = sheet.accountId ? accounts.find((account) => account.id === sheet.accountId) : undefined
  if (!existing && !canAddAccount(activeAccounts(accounts).length, access)) return <AccountLimit onClose={close} />
  return <AccountForm key={sheet.accountId ?? 'new'} existing={existing} onClose={close} />
}

function AccountForm({ existing, onClose }: { existing: Account | undefined; onClose: () => void }) {
  const { t } = useI18n()
  const store = useStore()
  const { accounts, trades } = useJournal()
  const ids = { name: useId(), venue: useId(), deposit: useId(), market: useId() }

  const [name, setName] = useState(existing?.name ?? '')
  const [assetClass, setAssetClass] = useState<AssetClass>(existing?.assetClass ?? 'cryptoPerp')
  const [venue, setVenue] = useState(existing?.venue ?? '')
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'USDT')
  const [deposit, setDeposit] = useState(existing?.depositAmount ?? '')
  const [colorHex, setColorHex] = useState(existing?.colorHex ?? TAG_COLORS[accounts.length % TAG_COLORS.length]!)
  const [errors, setErrors] = useState<{ name?: string; deposit?: string }>({})

  // The market of an account with trades is fixed: its trades' fields and math depend on it.
  const marketLocked = Boolean(existing && trades.some((trade) => trade.accountId === existing.id))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const depositAmount = deposit.trim() ? parsePositive(deposit) : undefined
    const nextErrors = {
      name: name.trim() ? undefined : t('accounts.error.name'),
      deposit: deposit.trim() && !depositAmount ? t('entry.error.price') : undefined,
    }
    if (nextErrors.name || nextErrors.deposit) return setErrors(nextErrors)

    const account: Account = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      assetClass: marketLocked && existing ? existing.assetClass : assetClass,
      venue: venue.trim(),
      currency,
      depositAmount,
      colorHex,
      sortOrder: existing?.sortOrder ?? accounts.length,
      isArchived: existing?.isArchived ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await store.saveAccount(account)
    onClose()
  }

  return (
    <Sheet
      open
      title={existing ? t('accounts.editTitle') : t('accounts.newTitle')}
      onClose={onClose}
      footer={
        <Button variant="primary" block type="submit" form="account-form">
          {t('action.save')}
        </Button>
      }
    >
      <form id="account-form" className="form-stack" onSubmit={save} noValidate>
        <Field label={t('accounts.name')} htmlFor={ids.name} error={errors.name}>
          <input
            id={ids.name}
            className="input"
            value={name}
            placeholder={t('accounts.namePlaceholder')}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label={t('entry.market')} htmlFor={ids.market} hint={marketLocked ? t('accounts.marketLocked') : undefined}>
          <select id={ids.market} className="input" value={assetClass} disabled={marketLocked} onChange={(event) => setAssetClass(event.target.value as AssetClass)}>
            {ASSET_CLASSES.map((item) => (
              <option key={item} value={item}>
                {t(`market.${item}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('accounts.venue')} htmlFor={ids.venue}>
          <input id={ids.venue} className="input" value={venue} placeholder="Binance, OKX, IBKR…" onChange={(event) => setVenue(event.target.value)} />
        </Field>

        <div className="form-grid">
          <Field label={t('accounts.currency')}>
            <Segmented label={t('accounts.currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((item) => ({ value: item, label: item }))} />
          </Field>
          <Field label={t('accounts.deposit')} htmlFor={ids.deposit} error={errors.deposit} hint={t('accounts.depositHint')}>
            <input id={ids.deposit} className="input numeric" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="field__label">{t('accounts.color')}</legend>
          <div className="color-picker">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-picker__swatch"
                style={{ background: color }}
                aria-pressed={color === colorHex}
                aria-label={color}
                onClick={() => setColorHex(color)}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  )
}

/** A second account on the free plan: what Pro gives instead of the form. */
function AccountLimit({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet open title={t('accounts.newTitle')} onClose={onClose}>
      <ProLock feature="multipleAccounts" onNavigate={onClose} />
    </Sheet>
  )
}
