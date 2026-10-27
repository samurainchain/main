import Foundation
import SwiftUI

// SwiftData models store these as raw strings (see the `*Raw` properties on the models):
// raw strings sync cleanly through CloudKit and keep working in predicates.

enum Side: String, Codable, CaseIterable, Identifiable, Sendable {
    case long
    case short

    var id: Self { self }

    /// +1 for long, −1 for short: the direction factor `d` in the PnL formula (SPEC section 6).
    var direction: Decimal { self == .long ? 1 : -1 }

    var title: LocalizedStringResource {
        switch self {
        case .long: "Long"
        case .short: "Short"
        }
    }
}

enum AssetClass: String, Codable, CaseIterable, Identifiable, Sendable {
    case cryptoSpot
    case cryptoPerp
    case stock
    case futures

    var id: Self { self }

    var title: LocalizedStringResource {
        switch self {
        case .cryptoSpot: "Crypto spot"
        case .cryptoPerp: "Crypto perpetuals"
        case .stock: "Stocks & ETFs"
        case .futures: "Futures"
        }
    }
}

enum Emotion: String, Codable, CaseIterable, Identifiable, Sendable {
    case calm
    case confident
    case fomo
    case anger
    case boredom
    case fear
    case greed

    var id: Self { self }

    var title: LocalizedStringResource {
        switch self {
        case .calm: "Calm"
        case .confident: "Confident"
        case .fomo: "FOMO"
        case .anger: "Anger"
        case .boredom: "Boredom"
        case .fear: "Fear"
        case .greed: "Greed"
        }
    }

    var systemImage: String {
        switch self {
        case .calm: "leaf"
        case .confident: "checkmark.seal"
        case .fomo: "hare"
        case .anger: "flame"
        case .boredom: "hourglass"
        case .fear: "exclamationmark.triangle"
        case .greed: "dollarsign.circle"
        }
    }
}

enum TradeSource: String, Codable, CaseIterable, Sendable {
    case manual
    case ocr
    case csvImport
}

enum Currency: String, Codable, CaseIterable, Identifiable, Sendable {
    case usd = "USD"
    case usdt = "USDT"

    var id: Self { self }

    /// ISO 4217 code for `FormatStyle`. USDT is a stablecoin pegged to USD and isn't
    /// an ISO currency, so its amounts are formatted as USD.
    var formatCode: String { "USD" }
}
