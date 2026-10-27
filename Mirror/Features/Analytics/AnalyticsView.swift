import SwiftUI

/// Cost of mistakes, charts and the PnL calendar (SPEC section 4.7). Stage 0: empty state only.
struct AnalyticsView: View {
    var body: some View {
        NavigationStack {
            EmptyState(
                title: "Nothing to analyze yet",
                message: "Log a few trades to see what your mistakes cost you.",
                systemImage: "chart.bar.xaxis"
            )
            .dsScreenBackground()
            .navigationTitle("Analytics")
        }
    }
}

#Preview {
    AnalyticsView()
}
