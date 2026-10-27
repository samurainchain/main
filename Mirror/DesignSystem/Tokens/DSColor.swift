import SwiftUI
import UIKit

/// Color tokens, shared with the web app (web/src/design/tokens.css): the Supabase-like
/// look from CLAUDE.md. Each token resolves to its dark or light value from the current
/// trait collection, so the app follows the system theme. Every text pair meets WCAG AA
/// (checked in web/src/design/contrast.test.ts).
enum DSColor {
    static let background = dynamic(dark: 0x121212, light: 0xFCFCFC)
    static let surface = dynamic(dark: 0x171717, light: 0xFFFFFF)
    static let surfaceElevated = dynamic(dark: 0x1F1F1F, light: 0xF4F4F4)
    static let border = dynamic(dark: 0x2E2E2E, light: 0xE4E4E4)
    static let borderStrong = dynamic(dark: 0x3E3E3E, light: 0xCFCFCF)
    static let textPrimary = dynamic(dark: 0xEDEDED, light: 0x171717)
    static let textSecondary = dynamic(dark: 0xA0A0A0, light: 0x666666)
    /// Links, icons, the selected tab.
    static let accent = dynamic(dark: 0x3ECF8E, light: 0x00744A)
    /// Filled primary buttons, with `accentFillBorder` around and white text.
    static let accentFill = dynamic(dark: 0x006239, light: 0x006239)
    static let accentFillBorder = dynamic(dark: 0x1F8A5C, light: 0x00744A)
    static let profit = dynamic(dark: 0x3ECF8E, light: 0x0A7D4F)
    static let loss = dynamic(dark: 0xF87171, light: 0xC92C40)
    static let warning = dynamic(dark: 0xF5A623, light: 0x8F5F00)
    static let separator = dynamic(dark: 0x2E2E2E, light: 0xE4E4E4)

    private static func dynamic(dark: UInt32, light: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension Color {
    /// Builds a color from a user-chosen `colorHex` stored on tags and accounts ("#RRGGBB").
    /// Falls back to the accent token when the string is malformed.
    init(hexString: String) {
        let digits = hexString.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else {
            self = DSColor.accent
            return
        }
        self = Color(uiColor: UIColor(hex: value))
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
