import Foundation
import SwiftData

/// A single trade (SPEC section 5).
///
/// CloudKit rules apply to every model: each property is optional or has a default,
/// there are no unique constraints, and all relationships are optional.
/// Derived values (pnl, rMultiple, duration, isWin, riskAmount) are not stored;
/// they belong to StatsEngine.
@Model
final class Trade {
    var id: UUID = UUID()
    var symbol: String = ""
    var sideRaw: String = Side.long.rawValue
    /// Copied from the account when the trade is created.
    var marketRaw: String = AssetClass.cryptoSpot.rawValue
    /// Only for crypto perpetuals.
    var leverage: Decimal?
    var entryPrice: Decimal = 0
    /// Empty means the trade is still open.
    var exitPrice: Decimal?
    /// In the base asset (coins, shares or contracts).
    var quantity: Decimal = 0
    /// Value of one point for futures, copied from the contract preset when the trade is logged
    /// so history doesn't change if the preset does. 1 for every other market.
    var contractMultiplier: Decimal = 1
    /// Stop at entry. Compared with `stopLoss` to tell whether the stop was moved.
    var initialStopLoss: Decimal?
    /// Latest stop; needed for R.
    var stopLoss: Decimal?
    var takeProfit: Decimal?
    /// In the account currency.
    var fees: Decimal = 0
    var openedAt: Date = Date.now
    var closedAt: Date?
    var emotionRaw: String?
    var note: String = ""
    var sourceRaw: String = TradeSource.manual.rawValue
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now

    var account: Account?

    @Relationship(inverse: \MistakeTag.trades)
    var mistakes: [MistakeTag]?

    @Relationship(inverse: \SetupTag.trades)
    var setups: [SetupTag]?

    @Relationship(inverse: \Rule.trades)
    var brokenRules: [Rule]?

    /// Up to 3 screenshots.
    @Relationship(deleteRule: .cascade, inverse: \TradeImage.trade)
    var screenshots: [TradeImage]?

    init(
        account: Account,
        symbol: String,
        side: Side,
        entryPrice: Decimal,
        quantity: Decimal,
        contractMultiplier: Decimal = 1,
        openedAt: Date = .now,
        source: TradeSource = .manual
    ) {
        self.account = account
        self.symbol = symbol
        self.sideRaw = side.rawValue
        self.marketRaw = account.assetClass.rawValue
        self.entryPrice = entryPrice
        self.quantity = quantity
        self.contractMultiplier = contractMultiplier
        self.openedAt = openedAt
        self.sourceRaw = source.rawValue
    }

    var side: Side {
        get { Side(rawValue: sideRaw) ?? .long }
        set { sideRaw = newValue.rawValue }
    }

    var market: AssetClass {
        get { AssetClass(rawValue: marketRaw) ?? .cryptoSpot }
        set { marketRaw = newValue.rawValue }
    }

    var emotion: Emotion? {
        get { emotionRaw.flatMap(Emotion.init(rawValue:)) }
        set { emotionRaw = newValue?.rawValue }
    }

    var source: TradeSource {
        get { TradeSource(rawValue: sourceRaw) ?? .manual }
        set { sourceRaw = newValue.rawValue }
    }

    var isOpen: Bool { exitPrice == nil }
}
