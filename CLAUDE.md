# Mirror — Trading Journal (iOS)

Full product spec: docs/SPEC.md. Read the relevant section before every task.

## Stack
- Swift 6, SwiftUI, iOS 26+, Xcode 26
- SwiftData + CloudKit (private DB), Swift Charts, Vision, WidgetKit
- RevenueCat for subscriptions (entitlement: "pro")
- No third-party UI libraries, no Combine, no ad/tracking SDKs

## Architecture rules
- Feature folders under Features/, each with View + @Observable ViewModel
- Business logic only in Core/ services, injected via @Environment
- Views never compute stats and never call RevenueCat directly
- All money values are Decimal, never Double
- Each trade belongs to an Account with an AssetClass (cryptoSpot, cryptoPerp, stock, futures); entry form fields and PnL math depend on it (futures use contract multiplier, see SPEC section 6)
- SwiftData models: every property optional or defaulted, no unique constraints, optional relationships (CloudKit requirement)
- StatsEngine = pure functions, fully unit-tested with Swift Testing

## UI rules
- Use only DesignSystem tokens and components; no hardcoded colors, fonts or spacing
- Native iOS 26 components and gestures first (sheets, swipe actions, context menus, Liquid Glass navigation)
- Every user-facing string goes through Localizable.xcstrings (en, ru, es)
- Numbers use .monospacedDigit(); profit/loss always shows sign, not only color
- Support Dynamic Type and VoiceOver on every screen

## Paywall rules (App Store Guideline 3.1.2)
- Billed amount is the most prominent price element
- No free-trial toggle; trial belongs to the annual plan card
- Show trial length and post-trial price; Restore, Terms, Privacy always visible
- Prices come from RevenueCat Offerings, never hardcoded

## Workflow
- Work one stage of docs/SPEC.md section 11 at a time
- Before coding, write a short plan and list files you will touch
- After coding: build, run tests, fix all warnings
- Never delete or rename models without a migration plan
- Ask me before adding any dependency

## Web app (web/)
- React + TypeScript + Vite, deployed to GitHub Pages by .github/workflows/web.yml
- Same product rules as the iOS app: SPEC is the source of truth, money via big.js decimal strings (never floats), design tokens in src/design/tokens.css
- Data lives in the browser (IndexedDB) behind the JournalBackend interface, so a cloud backend can be added later
- Per-trade math in src/core/pnl.ts, pure and unit-tested (Vitest)
- Every user-facing string goes through src/i18n/messages (en, ru, es); the ru/es catalogs are type-checked against en
- Before pushing: `npm run typecheck`, `npm test`, `npm run build` in web/
