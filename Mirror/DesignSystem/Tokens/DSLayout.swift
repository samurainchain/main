import SwiftUI

/// 4 pt spacing grid from SPEC section 9.
enum DSSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let s: CGFloat = 12
    static let m: CGFloat = 16
    static let l: CGFloat = 24
    static let xl: CGFloat = 32

    /// Horizontal screen margin.
    static let screen: CGFloat = m
}

/// Corner radii, shared with the web app: tight, with 1 pt borders instead of shadows.
enum DSRadius {
    static let card: CGFloat = 8
    static let button: CGFloat = 6
    /// Badges, calendar days and the value end of chart bars.
    static let small: CGFloat = 4
}
