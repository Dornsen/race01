function switchScreen(hideId, showId) {
    const hideEl = document.getElementById(hideId);
    const showEl = document.getElementById(showId);
    if (hideEl) hideEl.classList.add('hidden');
    if (showEl) showEl.classList.remove('hidden');
}

// --- OPEN SCREENS FROM MAIN MENU ---

const btnDeck = document.getElementById('btn-deck');
if (btnDeck) {
    btnDeck.onclick = async () => {
        switchScreen('main-menu', 'deck-builder');
        // Functions from deck.js
        if (typeof fetchCardsFromDB === 'function' && !hasLoadedCollection) await fetchCardsFromDB();
        if (typeof fetchMyDeck === 'function' && !hasLoadedDeck) await fetchMyDeck();
        if (typeof wireCollectionFilters === 'function') wireCollectionFilters();
        if (typeof renderDeckBuilder === 'function') renderDeckBuilder();
    };
}

const btnHistory = document.getElementById('btn-history');
if (btnHistory) {
    btnHistory.onclick = async () => {
        if (typeof leaveQueue === 'function') leaveQueue();
        switchScreen('main-menu', 'match-history');
        if (typeof fetchMatchHistory === 'function') await fetchMatchHistory();
    };
}

const btnLeaderboard = document.getElementById('btn-leaderboard');
if (btnLeaderboard) {
    btnLeaderboard.onclick = async () => {
        if (typeof leaveQueue === 'function') leaveQueue();
        switchScreen('main-menu', 'leaderboard');
        if (typeof fetchLeaderboard === 'function') await fetchLeaderboard();
    };
}

const btnQuests = document.getElementById('btn-quests');
if (btnQuests) {
    btnQuests.onclick = () => {
        if (typeof leaveQueue === 'function') leaveQueue();
        switchScreen('main-menu', 'quests');
    };
}

const btnShop = document.getElementById('btn-shop');
if (btnShop) {
    btnShop.onclick = () => {
        if (typeof leaveQueue === 'function') leaveQueue();
        if (typeof refreshBalance === 'function') refreshBalance();
        if (typeof fetchFrameShop === 'function') fetchFrameShop();
        switchScreen('main-menu', 'shop');
    };
}

const btnGacha = document.getElementById('btn-gacha');
if (btnGacha) {
    btnGacha.onclick = () => {
        if (typeof leaveQueue === 'function') leaveQueue();
        if (typeof refreshBalance === 'function') refreshBalance();
        switchScreen('main-menu', 'gacha');
    };
}

// --- GO BACK TO MAIN MENU ---

const btnBackLobby = document.getElementById('btn-back-lobby');
if (btnBackLobby) {
    btnBackLobby.onclick = () => switchScreen('deck-builder', 'main-menu');
}

const btnBackHistory = document.getElementById('btn-back-history');
if (btnBackHistory) {
    btnBackHistory.onclick = () => switchScreen('match-history', 'main-menu');
}

const btnBackLeaderboard = document.getElementById('btn-back-leaderboard');
if (btnBackLeaderboard) {
    btnBackLeaderboard.onclick = () => switchScreen('leaderboard', 'main-menu');
}

const btnBackQuests = document.getElementById('btn-back-quests');
if (btnBackQuests) {
    btnBackQuests.onclick = () => switchScreen('quests', 'main-menu');
}

const btnBackShop = document.getElementById('btn-back-shop');
if (btnBackShop) {
    btnBackShop.onclick = () => switchScreen('shop', 'main-menu');
}

const btnShopOmamoriPack = document.getElementById('btn-shop-omamori-pack');
if (btnShopOmamoriPack) {
    btnShopOmamoriPack.onclick = () => {
        if (typeof refreshBalance === 'function') refreshBalance();
        switchScreen('shop', 'gacha');
    };
}

const btnShopOmamoriRitual = document.getElementById('btn-shop-omamori-ritual');
if (btnShopOmamoriRitual) {
    btnShopOmamoriRitual.onclick = () => {
        if (typeof refreshBalance === 'function') refreshBalance();
        switchScreen('shop', 'gacha');
    };
}

const btnBackGacha = document.getElementById('btn-back-gacha');
if (btnBackGacha) {
    btnBackGacha.onclick = () => {
        switchScreen('gacha', 'main-menu');
        if (typeof resetGachaUI === 'function') resetGachaUI(); // From gacha.js
    };
}