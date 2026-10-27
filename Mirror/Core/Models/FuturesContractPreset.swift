import Foundation

/// A futures contract with its value per point. A static list in code, not in the store.
struct FuturesContractPreset: Identifiable, Hashable, Sendable {
    let symbol: String
    let name: String
    /// Dollar value of a one-point move for one contract.
    let multiplier: Decimal

    var id: String { symbol }

    static let all: [FuturesContractPreset] = [
        .init(symbol: "ES", name: "E-mini S&P 500", multiplier: 50),
        .init(symbol: "MES", name: "Micro E-mini S&P 500", multiplier: 5),
        .init(symbol: "NQ", name: "E-mini Nasdaq-100", multiplier: 20),
        .init(symbol: "MNQ", name: "Micro E-mini Nasdaq-100", multiplier: 2),
        .init(symbol: "YM", name: "E-mini Dow", multiplier: 5),
        .init(symbol: "RTY", name: "E-mini Russell 2000", multiplier: 50),
        .init(symbol: "CL", name: "Crude Oil", multiplier: 1000),
        .init(symbol: "GC", name: "Gold", multiplier: 100),
        .init(symbol: "MGC", name: "Micro Gold", multiplier: 10),
        .init(symbol: "SI", name: "Silver", multiplier: 5000),
    ]
}
