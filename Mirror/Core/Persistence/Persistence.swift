import Foundation
import SwiftData

enum Persistence {
    /// Every model type in the store. Keep in sync with `Core/Models`.
    static let schema = Schema([
        Trade.self,
        Account.self,
        MistakeTag.self,
        SetupTag.self,
        Rule.self,
        TradeImage.self,
        WeeklyReview.self,
        UserProfile.self,
    ])

    /// The app's container. CloudKit sync turns on once the target has the iCloud (CloudKit)
    /// capability; until then `.automatic` keeps the store local.
    static func makeContainer() throws -> ModelContainer {
        let configuration = ModelConfiguration(schema: schema, cloudKitDatabase: .automatic)
        return try ModelContainer(for: schema, configurations: [configuration])
    }

    /// An in-memory container for previews and tests.
    static func makeInMemoryContainer() throws -> ModelContainer {
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: true,
            cloudKitDatabase: .none
        )
        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
