import SwiftUI

/// Placeholder for a screen or block with no data yet, with an optional call to action.
struct EmptyState<Actions: View>: View {
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    let systemImage: String
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        ContentUnavailableView {
            Label {
                Text(title)
                    .foregroundStyle(DSColor.textPrimary)
            } icon: {
                Image(systemName: systemImage)
                    .foregroundStyle(DSColor.textSecondary)
            }
        } description: {
            Text(message)
                .foregroundStyle(DSColor.textSecondary)
        } actions: {
            actions()
        }
    }
}

extension EmptyState where Actions == EmptyView {
    init(title: LocalizedStringKey, message: LocalizedStringKey, systemImage: String) {
        self.init(title: title, message: message, systemImage: systemImage) { EmptyView() }
    }
}

#Preview {
    EmptyState(
        title: "No trades yet",
        message: "Trades you log will show up here.",
        systemImage: "list.bullet.rectangle"
    )
    .background(DSColor.background)
}
