import SwiftUI

/// Quick trade entry (SPEC section 4.4). Stage 0: an empty sheet; the form comes in stage 1.
struct QuickEntrySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            EmptyState(
                title: "New trade",
                message: "The entry form arrives in the next build.",
                systemImage: "square.and.pencil"
            )
            .dsScreenBackground()
            .navigationTitle("New trade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark", role: .cancel) {
                        dismiss()
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    QuickEntrySheet()
}
