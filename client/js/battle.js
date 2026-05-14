/* =========================================
   BATTLE.JS - IN-GAME MATCH LOGIC & RENDERING
   ========================================= */

// --- 1. HELPERS & UTILITIES ---

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

// --- 2. MATCH INITIALIZATION & STATE ---

async function startPracticeMatch() {
    if (typeof leaveQueue === 'function') leaveQueue();
    if (typeof fetchCardsFromDB === 'function' && !hasLoadedCollection) await fetchCardsFromDB();
    if (typeof fetchMyDeck === 'function') await fetchMyDeck();

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
            text.innerText = starter === 'player' ? 'Your Turn' : 'Opponent\'s Turn';
            
            setTimeout(() => {
                coin.classList.add('hidden');
                startTurn(starter);
                resolve();
            }, 800);
        }, 900);
    });
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

    if (!hasShownOnlineTurn && state.turn) {
        const text = state.turn === 'you' ? 'Your Turn' : 'Opponent\'s Turn';
        showCoinFlip(text);
        hasShownOnlineTurn = true;
    }

    startTimer();
    renderBattle();
}

// --- 3. TURN & TIMER LOGIC ---

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

    if (who === 'opponent' && !battleState.isOnline) {
        setTimeout(runOpponentTurn, 400); // Trigger bot logic
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

function scheduleAutoEndTurn() {
    if (autoEndTurnId) {
        clearTimeout(autoEndTurnId);
        autoEndTurnId = null;
    }
    
    if (!battleState.inBattle || battleState.turn !== 'player') return;
    if (battleState.player.hand.length > 0) return;
    
    const canAttack = battleState.player.board.some(card => !card.hasAttacked && !card.summoningSick);
    if (canAttack) return;

    // Auto end turn if no cards in hand and no possible attacks
    autoEndTurnId = setTimeout(() => {
        if (battleState.inBattle && battleState.turn === 'player') endTurn();
    }, 600);
}

// --- 4. RENDERING ---

function renderBattle() {
    updateBattleHeader();
    renderBattleBoard('player');
    renderBattleBoard('opponent');
    renderBattleHand();
    scheduleAutoEndTurn();
}

function updateBattleHeader() {
    const battleScreen = document.getElementById('battle-screen');
    const turnOwner = document.getElementById('turn-owner');
    const timer = document.getElementById('turn-timer');
    const turnIndicator = document.getElementById('turn-indicator');
    
    const playerHp = document.getElementById('player-hp');
    const opponentHp = document.getElementById('opponent-hp');
    const playerEnergy = document.getElementById('player-energy');
    const opponentEnergy = document.getElementById('opponent-energy');
    const playerHand = document.getElementById('player-hand-count');
    const opponentHand = document.getElementById('opponent-hand-count');

    if (turnOwner) turnOwner.innerText = battleState.turn === 'player' ? 'Player' : 'Opponent';
    
    if (battleScreen) {
        battleScreen.classList.toggle('turn-player', battleState.turn === 'player');
        battleScreen.classList.toggle('turn-opponent', battleState.turn === 'opponent');
    }
    
    if (turnIndicator) {
        const isPlayerTurn = battleState.turn === 'player';
        turnIndicator.innerText = isPlayerTurn ? 'Your Turn' : 'Opponent\'s Turn';
        turnIndicator.classList.toggle('opponent', !isPlayerTurn);
    }
    
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
    
    if (typeof getRarityColor === 'function') {
        el.style.borderColor = getRarityColor(card.rarity);
    }
    
    const color = typeof getRarityColor === 'function' ? getRarityColor(card.rarity) : '#7f8c8d';

    el.innerHTML = `
        <div class="battle-title">${card.name}</div>
        <div class="battle-cost" style="background: ${color}">${card.cost}</div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
            <img src="${encodeURI((card.image || '').trim())}" alt="${card.name}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px;">
        </div>
        <div class="battle-stats">
            <span>⚔️ ${card.attack}</span>
            <span class="battle-hp">🛡️ ${card.currentHp}</span>
        </div>
    `;

    el.oncontextmenu = (e) => {
        e.preventDefault();
        if (typeof showCardDetails === 'function') showCardDetails(card);
    };

    return el;
}

// --- 5. COMBAT LOGIC ---

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
    
    // Prevent direct attack if opponent has cards (Taunt simulation)
    if (battleState.opponent.board.length > 0) return;
    
    const attacker = battleState.player.board.find(c => c.uid === battleState.selectedAttackerId);
    if (!attacker || attacker.hasAttacked || attacker.summoningSick) return;

    battleState.opponent.hp -= attacker.attack;
    attacker.hasAttacked = true;
    battleState.selectedAttackerId = null;
    
    checkWin();
    renderBattle();
}

// --- 6. BOT LOGIC (Practice Mode) ---

function runOpponentTurn() {
    if (!battleState.inBattle || battleState.turn !== 'opponent') return;

    const opponent = battleState.opponent;
    const playable = opponent.hand.filter(card => card.cost <= opponent.energy);
    
    // Play as many cards as energy allows
    while (playable.length > 0) {
        playable.sort((a, b) => a.cost - b.cost); // Play cheapest first
        const card = playable.shift();
        
        if (!card || card.cost > opponent.energy) break;
        
        opponent.energy -= card.cost;
        opponent.hand = opponent.hand.filter(c => c.uid !== card.uid);
        
        card.summoningSick = true;
        card.hasAttacked = false;
        opponent.board.push(card);
        
        playable.splice(0, playable.length, ...opponent.hand.filter(c => c.cost <= opponent.energy));
    }

    // Attack logic
    opponent.board.forEach(card => {
        if (card.hasAttacked || card.summoningSick) return;
        
        if (battleState.player.board.length > 0) {
            // Attack random player card
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
            // Attack player directly
            battleState.player.hp -= card.attack;
            card.hasAttacked = true;
        }
    });

    checkWin();
    renderBattle();
    if (battleState.inBattle) endTurn();
}

// --- 7. END MATCH CONDITIONS ---

function checkWin() {
    if (battleState.player.hp <= 0) {
        endBattle('Opponent wins');
    } else if (battleState.opponent.hp <= 0) {
        endBattle('You win');
    }
}

function endBattle(message) {
    if (typeof showNotification === 'function') showNotification(message, false);
    battleState.inBattle = false;
    
    if (autoEndTurnId) {
        clearTimeout(autoEndTurnId);
        autoEndTurnId = null;
    }
    if (battleState.timerId) {
        clearInterval(battleState.timerId);
        battleState.timerId = null;
    }
    
    setTimeout(() => {
        setBattleScreenVisible(false);
    }, 1200);
}

function exitBattle(skipServer) {
    if (battleState.isOnline && !skipServer && socket) {
        socket.emit('leave_match');
    }
    
    const battleScreen = document.getElementById('battle-screen');
    if (battleScreen) {
        battleScreen.classList.remove('turn-player', 'turn-opponent');
    }
    
    battleState.inBattle = false;
    battleState.isOnline = false;
    battleState.mode = 'practice';
    
    if (autoEndTurnId) {
        clearTimeout(autoEndTurnId);
        autoEndTurnId = null;
    }
    if (battleState.timerId) {
        clearInterval(battleState.timerId);
        battleState.timerId = null;
    }
    
    setBattleScreenVisible(false);
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const btnPractice = document.getElementById('btn-practice');
    if (btnPractice) {
        btnPractice.onclick = async () => await startPracticeMatch();
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

    const opponentAvatarDOM = document.getElementById('opponent-avatar');
    if (opponentAvatarDOM) {
        opponentAvatarDOM.onclick = () => attackAvatar();
    }
});

// Expose globals for socketClient.js
window.applyServerState = applyServerState;
window.setBattleScreenVisible = setBattleScreenVisible;
window.syncBattleAvatars = syncBattleAvatars;
window.showCoinFlip = showCoinFlip;
window.exitBattle = exitBattle;