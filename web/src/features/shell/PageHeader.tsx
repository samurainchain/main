import type { ReactNode } from 'react'
import { AccountSwitcher } from '../accounts/AccountSwitcher'

export function PageHeader({
  title,
  subtitle,
  showAccountSwitcher = false,
  leading,
  trailing,
}: {
  title: string
  subtitle?: string
  showAccountSwitcher?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <header className="page-header">
      {leading}
      <div className="page-header__row">
        <div>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
          <h1 className="page-header__title">{title}</h1>
        </div>
        <div className="page-header__trailing">
          {showAccountSwitcher && <AccountSwitcher />}
          {trailing}
        </div>
      </div>
    </header>
  )
}
