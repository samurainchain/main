import Foundation
import SwiftData

/// A screenshot attached to a trade. Stored as JPEG (quality 0.8, ~1600 px on the long side),
/// outside the main store.
@Model
final class TradeImage {
    var id: UUID = UUID()
    @Attribute(.externalStorage)
    var data: Data?
    var createdAt: Date = Date.now

    var trade: Trade?

    init(data: Data) {
        self.data = data
    }
}
