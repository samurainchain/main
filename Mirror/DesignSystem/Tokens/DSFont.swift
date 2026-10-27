import SwiftUI

/// Typography tokens from SPEC section 9. Everything uses Dynamic Type text styles
/// so it scales with the user's text size.
enum DSFont {
    static let largeTitle = Font.largeTitle.weight(.bold)
    static let title = Font.title2.weight(.semibold)
    static let headline = Font.headline
    static let body = Font.body
    static let caption = Font.caption
}

extension View {
    /// Applies a typography token with tabular digits, so numbers don't jump as they change.
    func dsNumeric(_ font: Font = DSFont.body) -> some View {
        self.font(font).monospacedDigit()
    }

    /// Hero amounts such as the day's PnL: SF Pro Rounded, bold, 48 pt at the default
    /// text size and scaled with Dynamic Type.
    func dsHeroNumber() -> some View {
        modifier(HeroNumberModifier())
    }
}

private struct HeroNumberModifier: ViewModifier {
    @ScaledMetric(relativeTo: .largeTitle) private var size: CGFloat = 48

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: .bold, design: .rounded))
            .monospacedDigit()
    }
}
