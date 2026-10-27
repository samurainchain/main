import SwiftUI

/// A money amount that always carries its sign, so profit and loss never rely on color alone.
struct PnLText: View {
    enum Size {
        case regular
        case hero
    }

    let amount: Decimal
    let currencyCode: String
    var size: Size = .regular

    var body: some View {
        let text = Text(amount, format: .currency(code: currencyCode).sign(strategy: .always()))
            .foregroundStyle(color)
        switch size {
        case .regular:
            text.dsNumeric(DSFont.headline)
        case .hero:
            text.dsHeroNumber()
        }
    }

    private var color: Color {
        if amount > 0 { return DSColor.profit }
        if amount < 0 { return DSColor.loss }
        return DSColor.textPrimary
    }
}

#Preview {
    VStack(spacing: DSSpacing.m) {
        PnLText(amount: 1240.5, currencyCode: "USD", size: .hero)
        PnLText(amount: -82.1, currencyCode: "USD")
        PnLText(amount: 0, currencyCode: "USD")
    }
    .padding()
    .background(DSColor.background)
}
