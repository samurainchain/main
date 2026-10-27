import SwiftUI

/// Day summary, limits and recent trades (SPEC section 4.3). Stage 0: empty state only.
struct TodayView: View {
    @Environment(\.startTradeEntry) private var startTradeEntry

    var body: some View {
        NavigationStack {
            EmptyState(
                title: "Log your first trade",
                message: "Your day's PnL, limits and latest trades will show up here.",
                systemImage: "sun.max"
            ) {
                PrimaryButton(title: "New trade", systemImage: "plus") {
                    startTradeEntry()
                }
                .padding(.horizontal, DSSpacing.xl)
            }
            .dsScreenBackground()
            .navigationTitle("Today")
        }
    }
}

#Preview {
    TodayView()
}
