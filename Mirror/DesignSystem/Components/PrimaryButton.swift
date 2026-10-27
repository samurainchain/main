import SwiftUI

/// The main call to action on a screen: full width, accent fill, 14 pt corners.
struct PrimaryButton: View {
    let title: LocalizedStringKey
    var systemImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if let systemImage {
                    Label(title, systemImage: systemImage)
                } else {
                    Text(title)
                }
            }
            .font(DSFont.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DSSpacing.m)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: DSRadius.button))
        .tint(DSColor.accent)
    }
}

#Preview {
    PrimaryButton(title: "Log your first trade", systemImage: "plus") {}
        .padding()
        .background(DSColor.background)
}
