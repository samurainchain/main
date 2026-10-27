import SwiftData
import SwiftUI

/// The main tab bar: four tabs plus the center "+" that opens quick trade entry
/// as a sheet instead of switching tabs (SPEC section 3).
struct RootView: View {
    enum TabID: Hashable {
        case today
        case trades
        case newTrade
        case analytics
        case profile
    }

    @Environment(\.modelContext) private var modelContext
    @State private var selection: TabID = .today
    @State private var isEntryPresented = false

    var body: some View {
        TabView(selection: tabSelection) {
            Tab("Today", systemImage: "sun.max", value: TabID.today) {
                TodayView()
            }
            Tab("Trades", systemImage: "list.bullet.rectangle", value: TabID.trades) {
                TradesView()
            }
            Tab("New trade", systemImage: "plus.circle.fill", value: TabID.newTrade) {
                // Never shown: selecting this tab opens the entry sheet instead.
                Color.clear
            }
            Tab("Analytics", systemImage: "chart.bar.xaxis", value: TabID.analytics) {
                AnalyticsView()
            }
            Tab("Profile", systemImage: "person.crop.circle", value: TabID.profile) {
                ProfileView()
            }
        }
        .tint(DSColor.accent)
        .sheet(isPresented: $isEntryPresented) {
            QuickEntrySheet()
        }
        .environment(\.startTradeEntry, StartTradeEntryAction { isEntryPresented = true })
        .task {
            do {
                try SystemTagSeeder.seed(in: modelContext)
            } catch {
                assertionFailure("Seeding system tags failed: \(error)")
            }
        }
    }

    /// Keeps the current tab when "+" is tapped and presents the entry sheet instead.
    private var tabSelection: Binding<TabID> {
        Binding(
            get: { selection },
            set: { newValue in
                if newValue == .newTrade {
                    isEntryPresented = true
                } else {
                    selection = newValue
                }
            }
        )
    }
}

/// Opens quick trade entry from anywhere below `RootView`.
nonisolated struct StartTradeEntryAction: Sendable {
    private let action: @MainActor @Sendable () -> Void

    init(_ action: @escaping @MainActor @Sendable () -> Void) {
        self.action = action
    }

    @MainActor
    func callAsFunction() {
        action()
    }
}

extension EnvironmentValues {
    @Entry var startTradeEntry = StartTradeEntryAction {}
}

#Preview {
    RootView()
        .modelContainer(try! Persistence.makeInMemoryContainer())
}
