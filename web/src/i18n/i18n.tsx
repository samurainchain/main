import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSettings } from '../app/settings'
import { en, type MessageKey, type Messages, type PluralMessage } from './messages/en'
import { es } from './messages/es'
import { ru } from './messages/ru'

export type Locale = 'en' | 'ru' | 'es'
export const LOCALES: readonly Locale[] = ['en', 'ru', 'es']

const CATALOGS: Record<Locale, Messages> = { en, ru, es }

type Params = Record<string, string | number>

export interface Translator {
  locale: Locale
  t(key: MessageKey, params?: Params): string
  /** Picks the plural form for `count` and fills `{count}`. */
  tp(key: MessageKey, count: number, params?: Params): string
}

export function systemLocale(): Locale {
  for (const language of navigator.languages ?? [navigator.language]) {
    const code = language.slice(0, 2).toLowerCase()
    if ((LOCALES as readonly string[]).includes(code)) return code as Locale
  }
  return 'en'
}

export function createTranslator(locale: Locale): Translator {
  const messages = CATALOGS[locale]
  const plurals = new Intl.PluralRules(locale)

  const fill = (template: string, params?: Params) =>
    params ? template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : template

  return {
    locale,
    t(key, params) {
      const message = messages[key] ?? en[key]
      return fill(typeof message === 'string' ? message : message.other, params)
    },
    tp(key, count, params) {
      const message = messages[key] ?? en[key]
      if (typeof message === 'string') return fill(message, { count, ...params })
      const form = plurals.select(count) as keyof PluralMessage
      return fill(message[form] ?? message.other, { count, ...params })
    },
  }
}

const I18nContext = createContext<Translator>(createTranslator('en'))

export function I18nProvider({ children }: { children: ReactNode }) {
  const { language } = useSettings()
  const locale = language === 'system' ? systemLocale() : language
  const translator = useMemo(() => createTranslator(locale), [locale])
  document.documentElement.lang = locale
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>
}

export function useI18n(): Translator {
  return useContext(I18nContext)
}
