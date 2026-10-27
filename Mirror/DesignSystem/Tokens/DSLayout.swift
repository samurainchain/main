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

/// Corner radii from SPEC section 9. Chips use `Capsule` instead of a radius.
enum DSRadius {
    static let card: CGFloat = 20
    static let button: CGFloat = 14
}
