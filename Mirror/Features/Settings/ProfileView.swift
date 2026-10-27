import SwiftUI

/// Rules, weekly review, subscription and settings (SPEC section 4.10). Stage 0: empty state only.
struct ProfileView: View {
    var body: some View {
        NavigationStack {
            EmptyState(
                title: "Profile",
                message: "Your rules, weekly review, subscription and settings will live here.",
                systemImage: "person.crop.circle"
            )
            .dsScreenBackground()
            .navigationTitle("Profile")
        }
    }
}

#Preview {
    ProfileView()
}
