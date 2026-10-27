import Foundation
import SwiftData

/// The built-in mistake tags from SPEC section 5.
enum SystemMistake: String, CaseIterable, Sendable {
    case fomo
    case revengeTrading
    case heldPastStop
    case highLeverage
    case overtrading
    case earlyExit
    case noStop
    case offPlan
    case badHour

    var name: String {
        switch self {
        case .fomo: String(localized: "FOMO")
        case .revengeTrading: String(localized: "Revenge trading")
        case .heldPastStop: String(localized: "Held past stop")
        case .highLeverage: String(localized: "High leverage")
        case .overtrading: String(localized: "Overtrading")
        case .earlyExit: String(localized: "Early exit")
        case .noStop: String(localized: "No stop")
        case .offPlan: String(localized: "Against the plan")
        case .badHour: String(localized: "Bad hour")
        }
    }

    var iconName: String {
        switch self {
        case .fomo: "hare"
        case .revengeTrading: "arrow.uturn.backward.circle"
        case .heldPastStop: "hand.raised.slash"
        case .highLeverage: "gauge.with.dots.needle.100percent"
        case .overtrading: "repeat"
        case .earlyExit: "door.left.hand.open"
        case .noStop: "shield.slash"
        case .offPlan: "map"
        case .badHour: "clock.badge.exclamationmark"
        }
    }

    var colorHex: String {
        switch self {
        case .fomo, .revengeTrading, .highLeverage: "#FF5C6C"
        case .heldPastStop, .noStop: "#FFB547"
        case .overtrading, .earlyExit, .offPlan, .badHour: "#7C6CFF"
        }
    }
}

/// Inserts the system mistake tags that are missing. Safe to run on every launch.
///
/// Names are written in the device language at seeding time; after that they are
/// ordinary user-editable text.
enum SystemTagSeeder {
    static func seed(in context: ModelContext) throws {
        let existing = try context.fetch(
            FetchDescriptor<MistakeTag>(predicate: #Predicate { $0.isSystem })
        )
        let existingKeys = Set(existing.compactMap(\.systemKey))

        for (index, mistake) in SystemMistake.allCases.enumerated()
        where !existingKeys.contains(mistake.rawValue) {
            context.insert(MistakeTag(
                name: mistake.name,
                iconName: mistake.iconName,
                colorHex: mistake.colorHex,
                isSystem: true,
                systemKey: mistake.rawValue,
                sortOrder: index
            ))
        }

        if context.hasChanges {
            try context.save()
        }
    }
}
