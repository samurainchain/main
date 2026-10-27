import Foundation
import SwiftData

/// A trading account. Every trade belongs to one, and the account's asset class
/// decides which entry fields and PnL math apply (SPEC sections 4.11 and 5).
@Model
final class Account {
    var id: UUID = UUID()
    var name: String = ""
    var assetClassRaw: String = AssetClass.cryptoSpot.rawValue
    /// Exchange or broker, e.g. Binance or Interactive Brokers.
    var venue: String = ""
    var currencyRaw: String = Currency.usdt.rawValue
    /// Deposit used for "% of deposit" figures.
    var depositAmount: Decimal?
    var colorHex: String = "#7C6CFF"
    var sortOrder: Int = 0
    var isArchived: Bool = false
    var createdAt: Date = Date.now

    @Relationship(deleteRule: .cascade, inverse: \Trade.account)
    var trades: [Trade]?

    init(
        name: String,
        assetClass: AssetClass,
        venue: String = "",
        currency: Currency = .usdt,
        depositAmount: Decimal? = nil,
        sortOrder: Int = 0
    ) {
        self.name = name
        self.assetClassRaw = assetClass.rawValue
        self.venue = venue
        self.currencyRaw = currency.rawValue
        self.depositAmount = depositAmount
        self.sortOrder = sortOrder
    }

    var assetClass: AssetClass {
        get { AssetClass(rawValue: assetClassRaw) ?? .cryptoSpot }
        set { assetClassRaw = newValue.rawValue }
    }

    var currency: Currency {
        get { Currency(rawValue: currencyRaw) ?? .usdt }
        set { currencyRaw = newValue.rawValue }
    }
}
