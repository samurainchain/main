import Foundation
import SwiftData

/// A mistake tag. System tags are seeded on first launch; users can rename, recolor,
/// hide or add their own.
@Model
final class MistakeTag {
    var id: UUID = UUID()
    var name: String = ""
    var iconName: String = "exclamationmark.circle"
    var colorHex: String = "#FF5C6C"
    var isSystem: Bool = false
    /// Stable key for a seeded system tag (see `SystemMistake`). Lets the seeder find tags
    /// it already created, including copies that arrive from another device through iCloud.
    var systemKey: String?
    var sortOrder: Int = 0
    var isArchived: Bool = false

    var trades: [Trade]?

    init(
        name: String,
        iconName: String,
        colorHex: String,
        isSystem: Bool = false,
        systemKey: String? = nil,
        sortOrder: Int = 0
    ) {
        self.name = name
        self.iconName = iconName
        self.colorHex = colorHex
        self.isSystem = isSystem
        self.systemKey = systemKey
        self.sortOrder = sortOrder
    }
}

/// A setup tag. User-defined only.
@Model
final class SetupTag {
    var id: UUID = UUID()
    var name: String = ""
    var colorHex: String = "#7C6CFF"
    var sortOrder: Int = 0
    var isArchived: Bool = false

    var trades: [Trade]?

    init(name: String, colorHex: String, sortOrder: Int = 0) {
        self.name = name
        self.colorHex = colorHex
        self.sortOrder = sortOrder
    }
}

/// A personal trading rule. Trades record which rules they broke.
@Model
final class Rule {
    var id: UUID = UUID()
    var text: String = ""
    var isActive: Bool = true
    var sortOrder: Int = 0

    var trades: [Trade]?

    init(text: String, sortOrder: Int = 0) {
        self.text = text
        self.sortOrder = sortOrder
    }
}
