import SwiftUI

/// Trade list with filters (SPEC section 4.5). Stage 0: empty state only.
struct TradesView: View {
    var body: some View {
        NavigationStack {
            EmptyState(
                title: "No trades yet",
                message: "Trades you log will show up here.",
                systemImage: "list.bullet.rectangle"
            )
            .dsScreenBackground()
            .navigationTitle("Trades")
        }
    }
}

#Preview {
    TradesView()
}
