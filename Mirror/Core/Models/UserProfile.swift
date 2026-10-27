import Foundation
import SwiftData

/// Onboarding answers and personal limits. One per user.
///
/// The deposit lives on `Account`. Subscription status is not stored here:
/// RevenueCat is the source of truth.
@Model
final class UserProfile {
    var goal: String = ""
    var markets: [String] = []
    var exchanges: [String] = []
    var weaknesses: [String] = []
    var tradesPerWeek: Int = 0
    var currencyRaw: String = Currency.usdt.rawValue
    var depositAmount: Decimal?
    var dailyLossLimit: Decimal?
    var dailyTradeLimit: Int?
    /// `Calendar` weekday number: 1 = Sunday, 2 = Monday.
    var weekStartsOn: Int = 2
    /// `Calendar` weekday number for the weekly review reminder.
    var reviewWeekday: Int = 1
    var reviewHour: Int = 19
    var onboardingCompleted: Bool = false

    init() {}

    var currency: Currency {
        get { Currency(rawValue: currencyRaw) ?? .usdt }
        set { currencyRaw = newValue.rawValue }
    }
}
