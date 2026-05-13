let cardDatabase = []; // Все карты в игре
let myDeck = [];       // Карты, выбранные игроком
const MAX_DECK_SIZE = (window.GAME_CONFIG && window.GAME_CONFIG.deckSize) ? window.GAME_CONFIG.deckSize : 10;
let hasLoadedCollection = false;
let hasLoadedDeck = false;
let activeCardModal = null;
const GAME_CONFIG = window.GAME_CONFIG || {
    players: 2,
    health: 15,
    handLimit: 5,
    energyMax: 10,
    energyPerRound: 6,
    turnTimeSec: 30,
    deckSize: 10
};
const collectionFilters = {
    ownedOnly: false,
    rarity: 'all',
    costMin: '',
    costMax: '',
    search: ''
};

const deckMaxEl = document.getElementById('deck-max');
if (deckMaxEl) deckMaxEl.innerText = `${MAX_DECK_SIZE}`;

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

let socket = null;
let socketUser = null;
let queueMode = null;
let queueTimerId = null;
let queueStartAt = null;
let pendingInvite = null;

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОТРИСОВКИ КАРТ ---
function getRarityColor(rarity) {
    switch(rarity) {
        case 'common': return '#bdc3c7'; // Серый
        case 'rare': return '#3498db';   // Синий
        case 'epic': return '#9b59b6';   // Фиолетовый
        case 'legendary': return '#f1c40f'; // Золотой
        default: return '#7f8c8d';
    }
}

// Находим функцию createCardElement и заменяем её полностью
function createCardElement(cardData, options = {}) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.setAttribute('data-id', cardData.id);

    const isOwned = options.owned !== false;
    const inDeck = options.inDeck === true;

    if (!isOwned) cardEl.classList.add('card-locked');
    if (inDeck) {
        cardEl.style.borderColor = '#633D3D';
        cardEl.style.boxShadow = '0 0 15px rgba(99, 61, 61, 0.6)';
    }
    
    const cleanUrl = encodeURI(cardData.image.trim());

    cardEl.innerHTML = `
        <div class="card-cost">${cardData.cost}</div>
        <div class="card-art">
            <img src="${cleanUrl}" alt="${cardData.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div class="card-title">${cardData.name}</div>
        <div class="card-stats">
            <span>ATK: ${cardData.attack}</span>
            <span>DEF: ${cardData.defense}</span>
        </div>
        ${isOwned ? '' : '<div class="card-locked-overlay">LOCKED</div>'}
    `;

    // Клик для показа деталей в модалке (на иконку 'i' больше не полагаемся, кликаем по всей карте)
    cardEl.oncontextmenu = (e) => {
        e.preventDefault();
        showCardDetails(cardData);
    };

    return cardEl;
}
// --- 1. ЗАГРУЗКА ДАННЫХ ПРИ ВХОДЕ ---
async function fetchCardsFromDB() {
    try {
        const res = await fetch('/api/cards/collection');
        const data = await res.json();
        if (res.ok) {
            cardDatabase = data.cards.map(c => ({
                id: c.id, name: c.name, cost: c.cost, attack: c.attack, 
                defense: c.defense, rarity: c.rarity, image: c.avatar_url,
                owned: !!c.owned,
                description: c.description,
                ability: c.ability_description,
                clan: c.clan
            }));
            hasLoadedCollection = true;
        }
    } catch (e) { console.error("Ошибка загрузки базы карт", e); }
}

async function fetchMyDeck() {
    try {
        const res = await fetch('/api/decks/mine');
        const data = await res.json();
        if (res.ok && data.deck) {
            myDeck = data.deck.map(c => ({
                id: c.id, name: c.name, cost: c.cost, attack: c.attack, 
                defense: c.defense, rarity: c.rarity, image: c.avatar_url,
                description: c.description,
                ability: c.ability_description,
                clan: c.clan
            }));
            hasLoadedDeck = true;
            document.getElementById('deck-count').innerText = myDeck.length;
        } else if (res.ok) {
            myDeck = [];
            hasLoadedDeck = true;
            document.getElementById('deck-count').innerText = '0';
        }
    } catch (e) { console.error("Ошибка загрузки моей колоды", e); }
}

// --- 2. УПРАВЛЕНИЕ ОКНАМИ ---
const btnDeck = document.getElementById('btn-deck');
if (btnDeck) {
    btnDeck.onclick = async () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('deck-builder').classList.remove('hidden');
        if (!hasLoadedCollection) await fetchCardsFromDB();
        if (!hasLoadedDeck) await fetchMyDeck();
        wireCollectionFilters();
        renderDeckBuilder();
    };
}

const btnBackLobby = document.getElementById('btn-back-lobby');
if (btnBackLobby) {
    btnBackLobby.onclick = () => {
        document.getElementById('deck-builder').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
    };
}

// --- 3. ОТРИСОВКА И ЛОГИКА СБОРКИ ---
function renderDeckBuilder() {
    console.log("Проверка! Карт в базе:", cardDatabase.length, "| Карт в колоде:", myDeck.length);
    const colGrid = document.getElementById('collection-grid');
    const deckGrid = document.getElementById('current-deck-grid');
    const collectionCount = document.getElementById('collection-count');
    
    colGrid.innerHTML = '';
    deckGrid.innerHTML = '';

    // Левая панель (Коллекция)
    const ownedCount = cardDatabase.filter(card => card.owned).length;
    if (collectionCount) {
        collectionCount.innerText = `Collection: ${ownedCount} / ${cardDatabase.length}`;
    }

    const filteredCards = cardDatabase.filter(card => {
        if (collectionFilters.ownedOnly && !card.owned) return false;
        if (collectionFilters.rarity !== 'all' && card.rarity !== collectionFilters.rarity) return false;
        if (collectionFilters.costMin !== '' && card.cost < Number(collectionFilters.costMin)) return false;
        if (collectionFilters.costMax !== '' && card.cost > Number(collectionFilters.costMax)) return false;
        if (collectionFilters.search) {
            const haystack = `${card.name} ${card.clan || ''}`.toLowerCase();
            if (!haystack.includes(collectionFilters.search)) return false;
        }
        return true;
    });

    filteredCards.forEach(card => {
        const isInDeck = myDeck.some(c => c.id === card.id);
        const cardDOM = createCardElement(card, { owned: card.owned, inDeck: isInDeck });

        if (card.owned && !isInDeck) {
            cardDOM.onclick = () => addToDeck(card);
        } else {
            cardDOM.style.pointerEvents = 'none';
        }
        
        colGrid.appendChild(cardDOM);
    });

    // Правая панель (Колода)
    myDeck.forEach((card, index) => {
        const cardDOM = createCardElement(card, { owned: true, inDeck: true });
        cardDOM.onclick = () => removeFromDeck(index);
        deckGrid.appendChild(cardDOM);
    });

    document.getElementById('deck-count').innerText = myDeck.length;
}

function wireCollectionFilters() {
    const owned = document.getElementById('filter-owned');
    const rarity = document.getElementById('filter-rarity');
    const costMin = document.getElementById('filter-cost-min');
    const costMax = document.getElementById('filter-cost-max');
    const search = document.getElementById('filter-search');
    const reset = document.getElementById('filter-reset');

    if (!owned || !rarity || !costMin || !costMax || !search || !reset) return;

    owned.onchange = () => {
        collectionFilters.ownedOnly = owned.checked;
        renderDeckBuilder();
    };

    rarity.onchange = () => {
        collectionFilters.rarity = rarity.value;
        renderDeckBuilder();
    };

    costMin.oninput = () => {
        collectionFilters.costMin = costMin.value;
        renderDeckBuilder();
    };

    costMax.oninput = () => {
        collectionFilters.costMax = costMax.value;
        renderDeckBuilder();
    };

    search.oninput = () => {
        collectionFilters.search = search.value.trim().toLowerCase();
        renderDeckBuilder();
    };

    reset.onclick = () => {
        collectionFilters.ownedOnly = false;
        collectionFilters.rarity = 'all';
        collectionFilters.costMin = '';
        collectionFilters.costMax = '';
        collectionFilters.search = '';
        owned.checked = false;
        rarity.value = 'all';
        costMin.value = '';
        costMax.value = '';
        search.value = '';
        renderDeckBuilder();
    };
}

function addToDeck(card) {
    if (myDeck.length >= MAX_DECK_SIZE) return showNotification(`Max ${MAX_DECK_SIZE} cards!`, true);
    if (myDeck.some(c => c.id === card.id)) return showNotification('Card already in deck!', true);
    
    myDeck.push(card);
    renderDeckBuilder();
}

function removeFromDeck(index) {
    myDeck.splice(index, 1);
    renderDeckBuilder();
}

// --- 4. СОХРАНЕНИЕ НА СЕРВЕР ---
const btnSaveDeck = document.getElementById('btn-save-deck');
if (btnSaveDeck) {
    btnSaveDeck.onclick = async () => {
        if (myDeck.length !== MAX_DECK_SIZE) {
            return showNotification(`Collect exactly ${MAX_DECK_SIZE} cards! (You have: ${myDeck.length})`, true);
        }
        
        const cardIds = myDeck.map(card => card.id);
        const prevText = btnSaveDeck.innerText;
        btnSaveDeck.innerText = '⏳...';
        btnSaveDeck.disabled = true;

        try {
            const res = await fetch('/api/decks/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardIds })
            });
            const result = await res.json();
            showNotification(result.message || result.error, res.ok ? 'success' : 'error');
        } catch (e) {
            showNotification('Save failed', true);
        } finally {
            btnSaveDeck.innerText = prevText;
            btnSaveDeck.disabled = false;
        }
    };
}

// --- 5. ПРОСМОТР ОПИСАНИЯ КАРТ ---
function showCardDetails(card) {
    const modal = document.getElementById('card-detail-modal');
    const title = document.getElementById('card-detail-title');
    const body = document.getElementById('card-detail-body');
    if (!modal || !title || !body) return;

    title.innerText = card.name;
    const parts = [];
    if (card.description) parts.push(`<div><strong>Description:</strong> ${card.description}</div>`);
    if (card.ability) parts.push(`<div><strong>Ability:</strong> ${card.ability}</div>`);
    if (card.clan) parts.push(`<div><strong>Clan:</strong> ${card.clan}</div>`);
    parts.push(`<div><strong>Stats:</strong> ATK ${card.attack} / DEF ${card.defense} / COST ${card.cost}</div>`);

    body.innerHTML = parts.join('');
    modal.classList.remove('hidden');
    activeCardModal = modal;
}

const cardDetailClose = document.getElementById('card-detail-close');
if (cardDetailClose) {
    cardDetailClose.onclick = () => {
        const modal = document.getElementById('card-detail-modal');
        if (modal) modal.classList.add('hidden');
        activeCardModal = null;
    };
}

const cardDetailModal = document.getElementById('card-detail-modal');
if (cardDetailModal) {
    cardDetailModal.onclick = (e) => {
        if (e.target === cardDetailModal) {
            cardDetailModal.classList.add('hidden');
            activeCardModal = null;
        }
    };
}

function initSocket(user) {
    if (!user || socket) return;
    if (typeof io === 'undefined') return;

    socketUser = user;
    socket = io({ auth: { userId: user.id, username: user.username } });

    socket.on('queue_status', (payload) => {
        if (!payload) return;
        if (payload.status === 'queued') {
            queueMode = payload.mode;
            showQueuePanel(queueMode);
            showNotification(`Queued for ${payload.mode}.`);
        } else if (payload.status === 'idle') {
            queueMode = null;
            hideQueuePanel();
        } else if (payload.status === 'error') {
            showNotification(payload.message || 'Queue error', true);
            queueMode = null;
            hideQueuePanel();
        }
    });

    socket.on('match_start', (payload) => {
        battleState.isOnline = true;
        battleState.mode = payload.mode || 'casual';
        battleState.inBattle = true;
        hideQueuePanel();
        hideInviteModal();
        setBattleScreenVisible(true);
        syncBattleAvatars();
        const playerName = document.getElementById('player-name');
        const opponentName = document.getElementById('opponent-name');
        if (playerName) playerName.innerText = socketUser.username || 'Player';
        if (opponentName) opponentName.innerText = payload.opponent || 'Opponent';
        showCoinFlip('Flipping...');
    });

    socket.on('match_state', (state) => {
        applyServerState(state);
    });

    socket.on('match_end', async (payload) => {
        if (payload.result === 'draw') {
            showNotification('Draw');
        } else {
            showNotification(payload.result === 'win' ? 'You win!' : 'You lose', payload.result !== 'win');
        }
        if (battleState.isOnline) exitBattle(true);
        await refreshPlayerStats();
    });

    socket.on('friend_invite', (payload) => {
        if (!payload) return;
        pendingInvite = { fromUserId: payload.fromUserId, fromName: payload.fromName };
        showInviteModal(payload.fromName);
    });

    socket.on('friend_invite_cancel', () => {
        hideInviteModal();
    });

    socket.on('friend_invite_error', (payload) => {
        showNotification(payload.message || 'Invite error', true);
        hideInviteModal();
    });

    socket.on('disconnect', () => {
        if (battleState.isOnline) {
            showNotification('Connection lost', true);
            exitBattle(true);
        }
        hideQueuePanel();
        hideInviteModal();
    });
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    socketUser = null;
}

async function joinQueue(mode) {
    if (!socket) {
        showNotification('Connect first', true);
        return;
    }
    await fetchMyDeck();
    if (myDeck.length !== MAX_DECK_SIZE) {
        showNotification(`Save a ${MAX_DECK_SIZE}-card deck first.`, true);
        return;
    }
    socket.emit('queue_join', { mode });
}

function leaveQueue() {
    if (socket) socket.emit('queue_leave');
    hideQueuePanel();
}

function showInviteModal(name) {
    const inviteModal = document.getElementById('friend-invite-modal');
    const inviteText = document.getElementById('invite-text');
    if (!inviteModal || !inviteText) return;
    inviteText.innerText = `${name || 'Player'} invites you to battle.`;
    inviteModal.classList.remove('hidden');
}

function hideInviteModal() {
    const inviteModal = document.getElementById('friend-invite-modal');
    if (inviteModal) inviteModal.classList.add('hidden');
    pendingInvite = null;
}

function sendFriendInvite(friendId, friendName) {
    if (!socket) {
        showNotification('No connection', true);
        return;
    }
    socket.emit('friend_invite', { targetUserId: friendId });
    showNotification(`Battle request sent to ${friendName || ''}`);
}

function showQueuePanel(mode) {
    const panel = document.getElementById('queue-panel');
    const modeEl = document.getElementById('queue-mode');
    if (!panel || !modeEl) return;
    const label = mode === 'ranked' ? 'Ranked' : (mode === 'casual' ? 'Casual' : '-');
    modeEl.innerText = label;
    panel.classList.remove('hidden');
    queueStartAt = Date.now();
    startQueueTimer();
}

function hideQueuePanel() {
    const panel = document.getElementById('queue-panel');
    if (panel) panel.classList.add('hidden');
    stopQueueTimer();
}

function startQueueTimer() {
    stopQueueTimer();
    const timeEl = document.getElementById('queue-time');
    if (!timeEl) return;
    queueTimerId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - queueStartAt) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = `${elapsed % 60}`.padStart(2, '0');
        timeEl.innerText = `${mins}:${secs}`;
    }, 500);
}

function stopQueueTimer() {
    if (queueTimerId) {
        clearInterval(queueTimerId);
        queueTimerId = null;
    }
    queueStartAt = null;
    const timeEl = document.getElementById('queue-time');
    if (timeEl) timeEl.innerText = '0:00';
}

function showCoinFlip(text) {
    const coin = document.getElementById('coin-flip');
    const coinText = document.getElementById('coin-text');
    if (!coin || !coinText) return;
    coinText.innerText = text || 'Flipping...';
    coin.classList.remove('hidden');
    setTimeout(() => {
        coin.classList.add('hidden');
    }, 1200);
}

function applyServerState(state) {
    if (!state) return;
    battleState.isOnline = true;
    battleState.inBattle = true;
    battleState.mode = state.mode || 'casual';
    battleState.turn = state.turn === 'you' ? 'player' : 'opponent';
    battleState.turnEndsAt = state.turnEndsAt;
    battleState.timer = Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000));
    battleState.selectedAttackerId = null;
    battleState.player.hp = state.you.hp;
    battleState.player.energy = state.you.energy;
    battleState.player.hand = state.you.hand || [];
    battleState.player.board = state.you.board || [];
    battleState.opponent.hp = state.opponent.hp;
    battleState.opponent.energy = state.opponent.energy;
    battleState.opponent.board = state.opponent.board || [];
    battleState.opponent.handCount = state.opponent.handCount || 0;

    const playerName = document.getElementById('player-name');
    const opponentName = document.getElementById('opponent-name');
    if (playerName) playerName.innerText = state.you.name || 'Player';
    if (opponentName) opponentName.innerText = state.opponent.name || 'Opponent';

    startTimer();
    renderBattle();
}

async function refreshPlayerStats() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.isLoggedIn && typeof updatePlayerUI === 'function') {
            updatePlayerUI(data.user);
        }
    } catch (e) {
        console.error('Failed to refresh player stats', e);
    }
}

window.initSocket = initSocket;
window.disconnectSocket = disconnectSocket;
window.leaveQueue = leaveQueue;
window.sendFriendInvite = sendFriendInvite;

const btnPractice = document.getElementById('btn-practice');
if (btnPractice) {
    btnPractice.onclick = async () => {
        await startPracticeMatch();
    };
}

const btnRanked = document.querySelector('.mode-btn.ranked');
if (btnRanked) {
    btnRanked.onclick = () => joinQueue('ranked');
}

const btnCasual = document.querySelector('.mode-btn.casual');
if (btnCasual) {
    btnCasual.onclick = () => joinQueue('casual');
}

const btnExitBattle = document.getElementById('btn-exit-battle');
if (btnExitBattle) {
    btnExitBattle.onclick = () => exitBattle();
}

const btnEndTurn = document.getElementById('btn-end-turn');
if (btnEndTurn) {
    btnEndTurn.onclick = () => {
        if (battleState.inBattle && battleState.turn === 'player') endTurn();
    };
}

const opponentAvatar = document.getElementById('opponent-avatar');
if (opponentAvatar) {
    opponentAvatar.onclick = () => attackAvatar();
}

const btnCancelQueue = document.getElementById('btn-cancel-queue');
if (btnCancelQueue) {
    btnCancelQueue.onclick = () => leaveQueue();
}

const btnInviteAccept = document.getElementById('btn-invite-accept');
if (btnInviteAccept) {
    btnInviteAccept.onclick = () => {
        if (pendingInvite && socket) {
            socket.emit('friend_invite_accept', { fromUserId: pendingInvite.fromUserId });
        }
        hideInviteModal();
    };
}

const btnInviteDecline = document.getElementById('btn-invite-decline');
if (btnInviteDecline) {
    btnInviteDecline.onclick = () => {
        if (pendingInvite && socket) {
            socket.emit('friend_invite_decline', { fromUserId: pendingInvite.fromUserId });
        }
        hideInviteModal();
    };
}

// --- 3.1 BATTLE LOGIC ---
function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function makeBattleCard(card) {
    return {
        ...card,
        currentHp: card.defense,
        summoningSick: false,
        hasAttacked: false,
        uid: battleCardId++
    };
}

function drawUpToLimit(side) {
    while (side.hand.length < GAME_CONFIG.handLimit && side.deck.length > 0) {
        side.hand.push(side.deck.shift());
    }
}

function setBattleScreenVisible(isVisible) {
    const battle = document.getElementById('battle-screen');
    const lobby = document.getElementById('main-menu');
    const deck = document.getElementById('deck-builder');
    if (!battle || !lobby) return;
    if (isVisible) {
        if (deck) deck.classList.add('hidden');
        lobby.classList.add('hidden');
        battle.classList.remove('hidden');
    } else {
        battle.classList.add('hidden');
        lobby.classList.remove('hidden');
    }
}

async function startPracticeMatch() {
    leaveQueue();
    if (!hasLoadedCollection) await fetchCardsFromDB();
    await fetchMyDeck();

    if (myDeck.length !== GAME_CONFIG.deckSize) {
        showNotification(`Save a ${GAME_CONFIG.deckSize}-card deck first.`, true);
        return;
    }

    battleState.inBattle = true;
    battleState.isOnline = false;
    battleState.mode = 'practice';
    battleState.opponentHandCount = 0;
    battleState.selectedAttackerId = null;
    battleState.turnEndsAt = null;
    battleState.player.hp = GAME_CONFIG.health;
    battleState.opponent.hp = GAME_CONFIG.health;
    battleState.player.energy = 0;
    battleState.opponent.energy = 0;
    battleState.player.board = [];
    battleState.opponent.board = [];
    battleState.player.hand = [];
    battleState.opponent.hand = [];

    const playerDeck = shuffle(myDeck).map(makeBattleCard);
    const opponentDeckSource = shuffle(cardDatabase.length ? cardDatabase : myDeck);
    const opponentDeck = opponentDeckSource.slice(0, GAME_CONFIG.deckSize).map(makeBattleCard);

    battleState.player.deck = playerDeck;
    battleState.opponent.deck = opponentDeck;

    drawUpToLimit(battleState.player);
    drawUpToLimit(battleState.opponent);

    setBattleScreenVisible(true);
    syncBattleAvatars();
    await coinFlipStart();
}

function syncBattleAvatars() {
    const playerAvatar = document.getElementById('player-avatar');
    const opponentAvatar = document.getElementById('opponent-avatar');
    const lobbyAvatar = document.querySelector('.avatar-placeholder');

    if (playerAvatar && lobbyAvatar && lobbyAvatar.style.backgroundImage) {
        playerAvatar.style.backgroundImage = lobbyAvatar.style.backgroundImage;
    }

    if (opponentAvatar) {
        const fallback = 'assets/avatars/avatar2.png';
        opponentAvatar.style.backgroundImage = `url('${fallback}')`;
    }
}

function coinFlipStart() {
    return new Promise((resolve) => {
        const coin = document.getElementById('coin-flip');
        const text = document.getElementById('coin-text');
        if (!coin || !text) {
            startTurn(Math.random() > 0.5 ? 'player' : 'opponent');
            resolve();
            return;
        }

        coin.classList.remove('hidden');
        text.innerText = 'Flipping...';

        setTimeout(() => {
            const starter = Math.random() > 0.5 ? 'player' : 'opponent';
            text.innerText = starter === 'player' ? 'You start!' : 'Opponent starts!';
            setTimeout(() => {
                coin.classList.add('hidden');
                startTurn(starter);
                resolve();
            }, 800);
        }, 900);
    });
}

function startTurn(who) {
    battleState.turn = who;
    battleState.timer = GAME_CONFIG.turnTimeSec;
    battleState.turnEndsAt = Date.now() + GAME_CONFIG.turnTimeSec * 1000;
    battleState.selectedAttackerId = null;

    const side = who === 'player' ? battleState.player : battleState.opponent;
    side.energy = Math.min(GAME_CONFIG.energyMax, side.energy + GAME_CONFIG.energyPerRound);
    side.board.forEach(card => {
        card.hasAttacked = false;
        card.summoningSick = false;
    });
    drawUpToLimit(side);

    startTimer();
    renderBattle();

    if (who === 'opponent') {
        setTimeout(runOpponentTurn, 400);
    }
}

function startTimer() {
    if (battleState.timerId) clearInterval(battleState.timerId);
    if (battleState.isOnline) {
        battleState.timerId = setInterval(() => {
            if (!battleState.turnEndsAt) return;
            battleState.timer = Math.max(0, Math.ceil((battleState.turnEndsAt - Date.now()) / 1000));
            updateBattleHeader();
        }, 250);
        return;
    }

    battleState.timerId = setInterval(() => {
        battleState.timer -= 1;
        updateBattleHeader();
        if (battleState.timer <= 0) {
            if (battleState.turn === 'player') endTurn();
        }
    }, 1000);
}

function endTurn() {
    if (!battleState.inBattle) return;
    if (battleState.isOnline) {
        if (socket) socket.emit('end_turn');
        return;
    }
    const next = battleState.turn === 'player' ? 'opponent' : 'player';
    startTurn(next);
}

function exitBattle(skipServer) {
    if (battleState.isOnline && !skipServer && socket) {
        socket.emit('leave_match');
    }
    battleState.inBattle = false;
    battleState.isOnline = false;
    battleState.mode = 'practice';
    if (battleState.timerId) clearInterval(battleState.timerId);
    battleState.timerId = null;
    setBattleScreenVisible(false);
}

function renderBattle() {
    updateBattleHeader();
    renderBattleBoard('player');
    renderBattleBoard('opponent');
    renderBattleHand();
}

function updateBattleHeader() {
    const turnOwner = document.getElementById('turn-owner');
    const timer = document.getElementById('turn-timer');
    const playerHp = document.getElementById('player-hp');
    const opponentHp = document.getElementById('opponent-hp');
    const playerEnergy = document.getElementById('player-energy');
    const opponentEnergy = document.getElementById('opponent-energy');
    const playerHand = document.getElementById('player-hand-count');
    const opponentHand = document.getElementById('opponent-hand-count');

    if (turnOwner) turnOwner.innerText = battleState.turn === 'player' ? 'Player' : 'Opponent';
    if (timer) timer.innerText = `${battleState.timer}`;
    if (playerHp) playerHp.innerText = `${battleState.player.hp}`;
    if (opponentHp) opponentHp.innerText = `${battleState.opponent.hp}`;
    if (playerEnergy) playerEnergy.innerText = `${battleState.player.energy}`;
    if (opponentEnergy) opponentEnergy.innerText = `${battleState.opponent.energy}`;
    if (playerHand) playerHand.innerText = `${battleState.player.hand.length}`;
    if (opponentHand) {
        const count = battleState.isOnline ? battleState.opponentHandCount : battleState.opponent.hand.length;
        opponentHand.innerText = `${count}`;
    }
}

function renderBattleBoard(side) {
    const boardEl = document.getElementById(side === 'player' ? 'player-board' : 'opponent-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const cards = side === 'player' ? battleState.player.board : battleState.opponent.board;
    cards.forEach(card => {
        const cardEl = buildBattleCard(card);
        if (side === 'player') {
            cardEl.onclick = () => selectAttacker(card.uid);
            if (battleState.turn !== 'player' || card.hasAttacked || card.summoningSick) {
                cardEl.classList.add('disabled');
            }
        } else {
            cardEl.onclick = () => attackCard(card.uid);
        }
        if (battleState.selectedAttackerId === card.uid) cardEl.classList.add('selected');
        boardEl.appendChild(cardEl);
    });
}

function renderBattleHand() {
    const handEl = document.getElementById('player-hand');
    if (!handEl) return;
    handEl.innerHTML = '';

    battleState.player.hand.forEach(card => {
        const cardEl = buildBattleCard(card);
        const canPlay = battleState.turn === 'player' && card.cost <= battleState.player.energy;
        if (!canPlay) cardEl.classList.add('disabled');
        cardEl.onclick = () => playCardFromHand(card.uid);
        handEl.appendChild(cardEl);
    });
}

function buildBattleCard(card) {
    const el = document.createElement('div');
    el.className = 'battle-card';
    el.style.borderColor = getRarityColor(card.rarity);
    el.innerHTML = `
        <div class="battle-title">${card.name}</div>
        <div class="battle-cost" style="background: ${getRarityColor(card.rarity)}">${card.cost}</div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
            <img src="${encodeURI(card.image.trim())}" alt="${card.name}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px;">
        </div>
        <div class="battle-stats">
            <span>⚔️ ${card.attack}</span>
            <span class="battle-hp">🛡️ ${card.currentHp}</span>
        </div>
    `;

    el.oncontextmenu = (e) => {
        e.preventDefault();
        showCardDetails(card);
    };

    return el;
}

function playCardFromHand(uid) {
    if (!battleState.inBattle || battleState.turn !== 'player') return;
    if (battleState.isOnline) {
        if (socket) socket.emit('play_card', { uid });
        return;
    }
    const idx = battleState.player.hand.findIndex(card => card.uid === uid);
    if (idx === -1) return;
    const card = battleState.player.hand[idx];
    if (card.cost > battleState.player.energy) return;

    battleState.player.energy -= card.cost;
    battleState.player.hand.splice(idx, 1);
    card.summoningSick = true;
    card.hasAttacked = false;
    battleState.player.board.push(card);
    renderBattle();
}

function selectAttacker(uid) {
    if (!battleState.inBattle || battleState.turn !== 'player') return;
    const card = battleState.player.board.find(c => c.uid === uid);
    if (!card || card.hasAttacked || card.summoningSick) return;
    battleState.selectedAttackerId = uid;
    renderBattleBoard('player');
}

function attackCard(targetUid) {
    if (!battleState.inBattle || battleState.turn !== 'player') return;
    if (battleState.isOnline) {
        if (!battleState.selectedAttackerId) return;
        if (socket) {
            socket.emit('attack_card', {
                attackerUid: battleState.selectedAttackerId,
                targetUid: targetUid
            });
        }
        return;
    }
    const attacker = battleState.player.board.find(c => c.uid === battleState.selectedAttackerId);
    if (!attacker || attacker.hasAttacked || attacker.summoningSick) return;

    const target = battleState.opponent.board.find(c => c.uid === targetUid);
    if (!target) return;

    resolveCombat(attacker, target);
}

function resolveCombat(attacker, defender) {
    attacker.currentHp -= defender.attack;
    defender.currentHp -= attacker.attack;
    attacker.hasAttacked = true;

    if (attacker.currentHp <= 0) {
        battleState.player.board = battleState.player.board.filter(c => c.uid !== attacker.uid);
    }
    if (defender.currentHp <= 0) {
        battleState.opponent.board = battleState.opponent.board.filter(c => c.uid !== defender.uid);
    }

    battleState.selectedAttackerId = null;
    checkWin();
    renderBattle();
}

function attackAvatar() {
    if (!battleState.inBattle || battleState.turn !== 'player') return;
    if (battleState.isOnline) {
        if (!battleState.selectedAttackerId) return;
        if (socket) socket.emit('attack_avatar', { attackerUid: battleState.selectedAttackerId });
        return;
    }
    if (battleState.opponent.board.length > 0) return;
    const attacker = battleState.player.board.find(c => c.uid === battleState.selectedAttackerId);
    if (!attacker || attacker.hasAttacked || attacker.summoningSick) return;

    battleState.opponent.hp -= attacker.attack;
    attacker.hasAttacked = true;
    battleState.selectedAttackerId = null;
    checkWin();
    renderBattle();
}

function runOpponentTurn() {
    if (!battleState.inBattle || battleState.turn !== 'opponent') return;

    const opponent = battleState.opponent;
    const playable = opponent.hand.filter(card => card.cost <= opponent.energy);
    while (playable.length > 0) {
        playable.sort((a, b) => a.cost - b.cost);
        const card = playable.shift();
        if (!card || card.cost > opponent.energy) break;
        opponent.energy -= card.cost;
        opponent.hand = opponent.hand.filter(c => c.uid !== card.uid);
        card.summoningSick = true;
        card.hasAttacked = false;
        opponent.board.push(card);
        playable.splice(0, playable.length, ...opponent.hand.filter(c => c.cost <= opponent.energy));
    }

    opponent.board.forEach(card => {
        if (card.hasAttacked || card.summoningSick) return;
        if (battleState.player.board.length > 0) {
            const target = battleState.player.board[Math.floor(Math.random() * battleState.player.board.length)];
            target.currentHp -= card.attack;
            card.currentHp -= target.attack;
            card.hasAttacked = true;

            if (target.currentHp <= 0) {
                battleState.player.board = battleState.player.board.filter(c => c.uid !== target.uid);
            }
            if (card.currentHp <= 0) {
                battleState.opponent.board = battleState.opponent.board.filter(c => c.uid !== card.uid);
            }
        } else {
            battleState.player.hp -= card.attack;
            card.hasAttacked = true;
        }
    });

    checkWin();
    renderBattle();
    if (battleState.inBattle) endTurn();
}

function checkWin() {
    if (battleState.player.hp <= 0) {
        endBattle('Opponent wins');
    } else if (battleState.opponent.hp <= 0) {
        endBattle('You win');
    }
}

function endBattle(message) {
    showNotification(message, false);
    battleState.inBattle = false;
    if (battleState.timerId) clearInterval(battleState.timerId);
    battleState.timerId = null;
    setTimeout(() => {
        setBattleScreenVisible(false);
    }, 1200);
}