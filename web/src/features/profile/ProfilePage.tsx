import { ChevronRight, Download, Trash2, Upload, Wallet } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useJournal, useStore } from '../../app/journal'
import { routeHref } from '../../app/router'
import { updateSettings, useSettings, type LanguageSetting, type ThemeSetting } from '../../app/settings'
import { Button, Card, Field, SectionHeader } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'
import { downloadBackup, parseBackup, serializeBackup } from './backup'

/** Settings, accounts and data management (SPEC section 4.10, web subset). */
export function ProfilePage() {
  const { t, tp } = useI18n()
  const store = useStore()
  const { accounts, trades } = useJournal()
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()
  const ids = { language: useId(), theme: useId() }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const data = parseBackup(await file.text())
      if (!window.confirm(tp('profile.importConfirm', data.trades.length))) return
      await store.importData(data)
      updateSettings({ selectedAccount: 'all' })
      setMessage(t('profile.importDone'))
    } catch {
      setMessage(t('profile.importFailed'))
    }
  }

  const deleteAll = async () => {
    if (!window.confirm(t('profile.deleteAllConfirm'))) return
    await store.deleteAll()
    updateSettings({ selectedAccount: 'all' })
    setMessage(t('profile.deleteAllDone'))
  }

  return (
    <>
      <PageHeader title={t('tab.profile')} />

      <SectionHeader title={t('profile.journalSection')} />
      <a className="list-card nav-row" href={routeHref({ name: 'accounts' })}>
        <Wallet size={20} aria-hidden="true" />
        <span className="nav-row__label">{t('accounts.title')}</span>
        <span className="caption">{tp('profile.accountCount', accounts.length)}</span>
        <ChevronRight size={18} aria-hidden="true" className="secondary-text" />
      </a>

      <SectionHeader title={t('profile.appearanceSection')} />
      <Card className="form-stack">
        <Field label={t('profile.language')} htmlFor={ids.language}>
          <select id={ids.language} className="input" value={settings.language} onChange={(event) => updateSettings({ language: event.target.value as LanguageSetting })}>
            <option value="system">{t('profile.system')}</option>
            <option value="en">English</option>
            <option value="ru">Русский</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label={t('profile.theme')} htmlFor={ids.theme}>
          <select id={ids.theme} className="input" value={settings.theme} onChange={(event) => updateSettings({ theme: event.target.value as ThemeSetting })}>
            <option value="system">{t('profile.system')}</option>
            <option value="dark">{t('profile.themeDark')}</option>
            <option value="light">{t('profile.themeLight')}</option>
          </select>
        </Field>
      </Card>

      <SectionHeader title={t('profile.dataSection')} />
      <Card className="form-stack">
        <p className="secondary-text">{t('profile.storageNote')}</p>
        <div className="action-row action-row--wrap">
          <Button icon={<Download size={18} aria-hidden="true" />} disabled={trades.length === 0 && accounts.length === 0} onClick={() => downloadBackup(serializeBackup(store.exportData()))}>
            {t('profile.export')}
          </Button>
          <Button icon={<Upload size={18} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
            {t('profile.import')}
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
          <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={deleteAll}>
            {t('profile.deleteAll')}
          </Button>
        </div>
        {message && (
          <p className="caption" role="status">
            {message}
          </p>
        )}
      </Card>

      <p className="disclaimer caption">{t('profile.disclaimer')}</p>
    </>
  )
}
