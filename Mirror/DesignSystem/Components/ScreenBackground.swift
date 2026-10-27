import SwiftUI

extension View {
    /// Fills the screen behind the content with the `background` token.
    func dsScreenBackground() -> some View {
        frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(DSColor.background)
    }
}
