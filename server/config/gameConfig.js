module.exports = {
    players: 2,
    health: 15,
    handLimit: 5,
    energyMax: 10,
    energyPerRound: 6,
    turnTimeSec: 30,
    deckSize: 10,
    rankedWinDelta: 20,
    rankedLoseDelta: -20,
    gacha: {
        packSize: 5,
        packCost: 100,
        packCost10: 900,
        odds: {
            common: 70,
            rare: 20,
            epic: 8,
            legendary: 2
        }
    }
};
