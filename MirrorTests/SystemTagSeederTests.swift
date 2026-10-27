import Foundation
import SwiftData
import Testing
@testable import Mirror

@MainActor
struct SystemTagSeederTests {
    @Test func seedsEverySystemMistakeOnce() throws {
        let container = try Persistence.makeInMemoryContainer()
        let context = container.mainContext

        try SystemTagSeeder.seed(in: context)
        try SystemTagSeeder.seed(in: context)

        let tags = try context.fetch(FetchDescriptor<MistakeTag>())
        #expect(tags.count == SystemMistake.allCases.count)
        #expect(Set(tags.compactMap(\.systemKey)) == Set(SystemMistake.allCases.map(\.rawValue)))
        #expect(tags.allSatisfy(\.isSystem))
    }

    @Test func restoresOnlyMissingTagsAndKeepsUserEdits() throws {
        let container = try Persistence.makeInMemoryContainer()
        let context = container.mainContext
        try SystemTagSeeder.seed(in: context)

        let tags = try context.fetch(FetchDescriptor<MistakeTag>())
        let renamed = try #require(tags.first { $0.systemKey == SystemMistake.fomo.rawValue })
        renamed.name = "Chasing"
        let deleted = try #require(tags.first { $0.systemKey == SystemMistake.noStop.rawValue })
        context.delete(deleted)
        try context.save()

        try SystemTagSeeder.seed(in: context)

        let reseeded = try context.fetch(FetchDescriptor<MistakeTag>())
        #expect(reseeded.count == SystemMistake.allCases.count)
        #expect(reseeded.first { $0.systemKey == SystemMistake.fomo.rawValue }?.name == "Chasing")
    }

    @Test func tradeCopiesMarketFromAccount() throws {
        let container = try Persistence.makeInMemoryContainer()
        let context = container.mainContext
        let account = Account(name: "CME", assetClass: .futures, venue: "NinjaTrader", currency: .usd)
        context.insert(account)

        let trade = Trade(account: account, symbol: "MES", side: .short, entryPrice: 5000, quantity: 2, contractMultiplier: 5)
        context.insert(trade)
        try context.save()

        #expect(trade.market == .futures)
        #expect(trade.side.direction == -1)
        #expect(account.trades?.count == 1)
    }
}
