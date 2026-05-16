// --- DECK & COLLECTION STATE ---
let cardDatabase = [];
let myDeck = [];
let hasLoadedCollection = false;
let hasLoadedDeck = false;

// --- CONFIGURATION ---
const GAME_CONFIG = window.GAME_CONFIG || {
    players: 2,
    health: 15,
    handLimit: 5,
    energyMax: 10,
    energyPerRound: 6,
    turnTimeSec: 30,
    deckSize: 10
};

const MAX_DECK_SIZE = GAME_CONFIG.deckSize || 10;

const deckMaxEl = document.getElementById('deck-max');
if (deckMaxEl) deckMaxEl.innerText = `${MAX_DECK_SIZE}`;

const collectionFilters = {
    ownedOnly: false,
    rarity: 'all',
    costMin: '',
    costMax: '',
    search: ''
};

// --- BATTLE STATE ---
let battleCardId = 1;
const battleState = {
    inBattle: false,
    isOnline: false,
    mode: 'practice',
    turn: null,
    timer: GAME_CONFIG.turnTimeSec,
    timerId: null,
    turnEndsAt: null,
    selectedAttackerId: null,
    player: { hp: 0, energy: 0, hand: [], deck: [], board: [] },
    opponent: { hp: 0, energy: 0, hand: [], deck: [], board: [] },
    opponentHandCount: 0
};

// --- MULTIPLAYER & SYSTEM STATE ---
let socket = null;
let socketUser = null;
let queueMode = null;
let queueTimerId = null;
let queueStartAt = null;
let pendingInvite = null;
let historyCache = [];
let hasShownOnlineTurn = false;
let historyDelta = { win: 0, lose: 0 };
let autoEndTurnId = null;
let currentMoney = 0;
let activeCardModal = null;

window.createAvatarElement = function(avatarUrl, frameUrl = null, size = 64) {
    const container = document.createElement('div');
    container.className = 'avatar-container';
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl || '/assets/avatars/avatar1.png';
    avatarImg.className = 'base-avatar';
    container.appendChild(avatarImg);

    if (frameUrl) {
        const frameImg = document.createElement('img');
        frameImg.src = frameUrl;
        frameImg.className = 'frame-overlay';
        container.appendChild(frameImg);
    }

    return container;
};