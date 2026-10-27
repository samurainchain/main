import Foundation
import SwiftData

/// The user's answers to the Sunday review (SPEC section 4.9).
@Model
final class WeeklyReview {
    var id: UUID = UUID()
    var weekStart: Date = Date.now
    var whatWorked: String = ""
    var whatRepeated: String = ""
    var nextRule: String = ""
    var createdAt: Date = Date.now

    init(weekStart: Date) {
        self.weekStart = weekStart
    }
}
