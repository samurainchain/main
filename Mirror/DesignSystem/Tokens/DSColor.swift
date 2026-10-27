import SwiftUI
import UIKit

/// Color tokens from SPEC section 9. Each token resolves to its dark or light
/// value from the current trait collection, so the app follows the system theme.
enum DSColor {
    static let background = dynamic(dark: 0x0B0B0F, light: 0xF6F6F8)
    static let surface = dynamic(dark: 0x16161C, light: 0xFFFFFF)
    static let surfaceElevated = dynamic(dark: 0x1F1F27, light: 0xF0F0F4)
    static let textPrimary = dynamic(dark: 0xF5F5F7, light: 0x0B0B0F)
    static let textSecondary = dynamic(dark: 0x8E8E99, light: 0x6B6B76)
    static let accent = dynamic(dark: 0x7C6CFF, light: 0x5B4BE8)
    static let profit = dynamic(dark: 0x3DDC97, light: 0x12A66B)
    static let loss = dynamic(dark: 0xFF5C6C, light: 0xD93448)
    static let warning = dynamic(dark: 0xFFB547, light: 0xC98400)
    static let separator = dynamic(dark: 0x2A2A33, light: 0xE3E3E8)

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
