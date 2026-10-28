import { Lock, Sparkles } from 'lucide-react'
import { routeHref } from '../../app/router'
import type { ProFeature } from '../../core/entitlements'
import { useI18n } from '../../i18n/i18n'

/**
 * What a free user sees in place of a Pro feature: what it gives and a way to Pro. Never hides
 * the trader's data; it only stands in for the part that needs Pro.
 */
export function ProLock({ feature, compact = false, onNavigate }: { feature: ProFeature; compact?: boolean; onNavigate?: () => void }) {
  const { t } = useI18n()
  return (
    <div className={`pro-lock${compact ? ' pro-lock--compact' : ''}`}>
      <span className="pro-lock__icon" aria-hidden="true">
        <Lock size={compact ? 16 : 20} />
      </span>
      <div className="pro-lock__text">
        <p className="pro-lock__title">{t(`proLock.${feature}`)}</p>
        {!compact && <p className="secondary-text">{t(`proLock.${feature}Text`)}</p>}
      </div>
      <a className="button button--primary pro-lock__button" href={routeHref({ name: 'pro' })} onClick={onNavigate}>
        <Sparkles size={16} aria-hidden="true" />
        {t('proLock.open')}
      </a>
    </div>
  )
}
