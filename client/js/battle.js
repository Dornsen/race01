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
    // Оставляем пустой. 
    // Стартовая анимация теперь обрабатывается в новой функции coinFlipStart().
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
        const coinOverlay = document.getElementById('coin-flip-overlay');
        const centerCoin = document.getElementById('coin-flip-center');

        if (!coinOverlay || !centerCoin) {
            startTurn(Math.random() > 0.5 ? 'player' : 'opponent');
            resolve();
            return;
        }

        // Очищаем предыдущий результат и запускаем спин
        coinOverlay.innerHTML = '';
        coinOverlay.classList.remove('hidden');

        // Большая монета — вопрос (知: «знание/судьба»)
        const bigCoin = document.createElement('div');
        bigCoin.id = 'coin-flip-center';
        bigCoin.className = 'turn-coin start-coin spinning-fast';
        bigCoin.innerHTML = `<span class="start-coin-kanji">命</span>`;
        coinOverlay.appendChild(bigCoin);

        // Через 1.1s — останавливаем, показываем результат
        setTimeout(() => {
            const starter = Math.random() > 0.5 ? 'player' : 'opponent';
            bigCoin.classList.remove('spinning-fast');

            // 先攻 (senkou) = ходишь первым | 後攻 (koukou) = вторым
            if (starter === 'player') {
                bigCoin.innerHTML = `<span class="start-coin-kanji">先</span>`;
            } else {
                bigCoin.innerHTML = `<span class="start-coin-kanji">後</span>`;
            }

            // Текст-результат под монетой
            const resultEl = document.createElement('div');
            resultEl.className = 'coin-flip-result';
            resultEl.innerHTML = starter === 'player'
                ? `<span class="kanji-big">先攻</span>
                   <span class="kanji-sub">SENKOU</span>
                   <span class="kanji-ruby">Your turn first</span>`
                : `<span class="kanji-big">後攻</span>
                   <span class="kanji-sub">KOUKOU</span>
                   <span class="kanji-ruby">Opponent goes first</span>`;
            coinOverlay.appendChild(resultEl);

            // Обновляем маленькую монету на трекере заранее
            const smallCoin = document.getElementById('turn-coin');
            if (smallCoin) {
                smallCoin.innerHTML = `<span class="turn-coin-kanji">${starter === 'player' ? '先' : '後'}</span>`;
            }

            // Через 1.4s — монета улетает влево к трекеру
            setTimeout(() => {
                bigCoin.classList.add('move-to-indicator');

                setTimeout(() => {
                    coinOverlay.classList.add('hidden');
                    bigCoin.classList.remove('move-to-indicator');
                    startTurn(starter);
                    resolve();
                }, 750);
            }, 1400);
        }, 1100);
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
    const timer = document.getElementById('turn-timer');
    const btnEndTurn = document.getElementById('btn-end-turn');
    
    const playerHp = document.getElementById('player-hp');
    const opponentHp = document.getElementById('opponent-hp');

    if (battleScreen) {
        battleScreen.classList.toggle('turn-player', battleState.turn === 'player');
        battleScreen.classList.toggle('turn-opponent', battleState.turn === 'opponent');
    }
    
    // Timer text and Warning Pulse
    if (timer) {
        timer.innerText = `${battleState.timer}`;
        if (battleState.timer <= 5) {
            timer.parentElement.classList.add('timer-warning');
        } else {
            timer.parentElement.classList.remove('timer-warning');
        }
    }
    
    // HP Updates with Damage Flash Animation
    if (playerHp && playerHp.innerText !== `${battleState.player.hp}`) {
        playerHp.parentElement.classList.remove('hp-damage');
        void playerHp.parentElement.offsetWidth; // trigger reflow
        playerHp.parentElement.classList.add('hp-damage');
        playerHp.innerText = `${battleState.player.hp}`;
    }
    if (opponentHp && opponentHp.innerText !== `${battleState.opponent.hp}`) {
        opponentHp.parentElement.classList.remove('hp-damage');
        void opponentHp.parentElement.offsetWidth; // trigger reflow
        opponentHp.parentElement.classList.add('hp-damage');
        opponentHp.innerText = `${battleState.opponent.hp}`;
    }

    // Update End Turn Button State
    if (btnEndTurn) {
        if (battleState.turn === 'player') {
            btnEndTurn.classList.remove('disabled');
            btnEndTurn.disabled = false;
        } else {
            btnEndTurn.classList.add('disabled');
            btnEndTurn.disabled = true;
        }
    }

    // Call new Visual Presentation Sub-routines
    renderManaArc();
    renderOpponentHandVisually();
    updateTurnCoin();
}

function updateTurnCoin() {
    const coin = document.getElementById('turn-coin');
    if (!coin) return;

    // Заменяем SVG-стрелку кандзи (先 = первый / 後 = второй)
    const existingKanji = coin.querySelector('.turn-coin-kanji');
    if (!existingKanji) {
        coin.innerHTML = `<span class="turn-coin-kanji">${battleState.turn === 'player' ? '先' : '後'}</span>`;
    } else {
        existingKanji.textContent = battleState.turn === 'player' ? '先' : '後';
    }

    if (battleState.turn === 'player') {
        coin.classList.remove('opponent-turn');
        coin.classList.add('player-turn');
    } else {
        coin.classList.add('opponent-turn');
        coin.classList.remove('player-turn');
    }
}

function renderManaArc() {
    const arcContainer = document.getElementById('player-mana-arc');
    if (!arcContainer) return;
    arcContainer.innerHTML = '';
    
    const totalMana = GAME_CONFIG.energyMax || 10;
    const currentMana = battleState.player.energy;
    
    // ==========================================
    // НАСТРОЙКИ ДУГИ
    // ==========================================
    
    const startPercent = { x: 8, y: 60 };
    const endPercent = { x: 78, y: 105 };

    const rect = arcContainer.getBoundingClientRect();
    const startPx = { x: rect.left + (startPercent.x / 100) * rect.width, y: rect.top + (startPercent.y / 100) * rect.height };
    const endPx = { x: rect.left + (endPercent.x / 100) * rect.width, y: rect.top + (endPercent.y / 100) * rect.height };

    const curveStrengthPx = -Math.max(rect.width, rect.height) * 0.18;
    const verticalOffsetPx = rect.height * 0.18; 
    const rotateDeg = 165;
    
    // Смещение ГОТОВОЙ дуги — адаптивно под высоту экрана
    const finalShiftX = -21;
    const finalShiftY = window.innerHeight * 0.695; // ~675px при 1080px, масштабируется

    const tStart = 0.38;
    const tEnd = 0.62;

    for (let i = 0; i < totalMana; i++) {
        const baseT = totalMana > 1 ? i / (totalMana - 1) : 0.5;
        const t = tStart + (tEnd - tStart) * baseT;

        const midBase = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };
        const dir = { x: endPx.x - startPx.x, y: endPx.y - startPx.y };
        const len = Math.hypot(dir.x, dir.y) || 1;
        const ndir = { x: dir.x / len, y: dir.y / len };

        const perp = { x: -ndir.y, y: ndir.x };
        const midPx = { x: midBase.x + perp.x * curveStrengthPx, y: midBase.y + perp.y * curveStrengthPx };

        let x = (1 - t) * (1 - t) * startPx.x + 2 * (1 - t) * t * midPx.x + t * t * endPx.x;
        let y = (1 - t) * (1 - t) * startPx.y + 2 * (1 - t) * t * midPx.y + t * t * endPx.y;

        y += verticalOffsetPx;

        const dx = 2 * (1 - t) * (midPx.x - startPx.x) + 2 * t * (endPx.x - midPx.x);
        const dy = 2 * (1 - t) * (midPx.y - startPx.y) + 2 * t * (endPx.y - midPx.y);
        const angle = Math.atan2(dy, dx);
        let rot = angle * (180 / Math.PI) - 90;
        
        const manaIcon = document.createElement('div');
        manaIcon.className = `mana-icon ${i < currentMana ? 'active' : 'inactive'}`;
        
        manaIcon.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 517 504" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1,0,0,1,-281.190002,-1247.77002)">
                <path d="M548.624,1483.54C740.065,1421.1 719.771,1343.88 689.53,1269.33L654.728,1286.49L657.266,1247.77C601.855,1248.18 547.087,1253.43 523.443,1322.24C529.829,1335.16 534.956,1350.12 538.913,1367.34C546.129,1398.74 549.328,1436.91 548.624,1483.54Z" style="fill:rgb(255,108,149);"/>
                <path d="M797.803,1529.09C780.292,1476.52 758.375,1426.05 685.619,1424.83C678.255,1432.01 669.697,1438.91 659.874,1445.59C633.208,1463.73 598.011,1479.8 552.271,1494.72L540.056,1498.71C658.568,1661.39 725.717,1618.23 787.271,1566.44L760.195,1538.65L797.803,1529.09Z" style="fill:rgb(255,108,149);"/>
                <path d="M617.389,1597.85C589.814,1578.16 561.409,1547.99 530.55,1505.63L522.925,1495.17C404.832,1658.15 466.625,1708.67 534.902,1751.21L552.97,1716.87L573.675,1749.69C618.268,1716.78 659.494,1680.34 638.164,1610.76C631.311,1607.16 624.396,1602.86 617.389,1597.85Z" style="fill:rgb(255,108,149);"/>
                <path d="M375.777,1444.8C383.961,1443.61 392.65,1443.01 401.868,1443.01C435.431,1443.01 475.583,1450.72 524.621,1466.59L536.943,1470.57C536.684,1269.31 456.994,1264.75 376.754,1270.47L382.322,1308.87L346.282,1294.49C329.544,1347.32 317.611,1401.04 375.777,1444.8Z" style="fill:rgb(255,108,149);"/>
                <path d="M521,1477.78C329.503,1415.83 300.544,1490.21 281.19,1568.29L319.432,1574.86L294.62,1604.7C339.689,1636.94 387.084,1664.88 446.662,1623.1C448.4,1612.98 451.264,1602.38 455.277,1591.21C466.175,1560.88 485.188,1527.2 513.401,1488.27L521,1477.78Z" style="fill:rgb(255,108,149);"/>
            </g>
        </svg>`;
        
        if (rotateDeg % 360 !== 0) {
            const theta = (rotateDeg * Math.PI) / 180;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            
            let rx = cx + Math.cos(theta) * dx - Math.sin(theta) * dy;
            let ry = cy + Math.sin(theta) * dx + Math.cos(theta) * dy;
            
            // ДОБАВЛЯЕМ СМЕЩЕНИЕ ПОСЛЕ ПОВОРОТА
            rx += finalShiftX;
            ry += finalShiftY;

            manaIcon.style.left = `${Math.round(rx)}px`;
            manaIcon.style.top = `${Math.round(ry)}px`;
            rot += rotateDeg;
        } else {
            // И здесь на всякий случай, если ты уберешь поворот
            manaIcon.style.left = `${Math.round(x + finalShiftX)}px`;
            manaIcon.style.top = `${Math.round(y + finalShiftY)}px`;
        }

        manaIcon.style.setProperty('--rot', `${rot}deg`);
        manaIcon.style.transform = `rotate(${rot}deg)`;
        
        arcContainer.appendChild(manaIcon);
    }
}

function renderOpponentHandVisually() {
    const handEl = document.getElementById('opponent-hand');
    if (!handEl) return;
    handEl.innerHTML = '';
    
    const count = battleState.isOnline ? battleState.opponentHandCount : battleState.opponent.hand.length;
    const displayCount = Math.min(count, 5); // Limit visual render overlap
    
    for (let i = 0; i < displayCount; i++) {
        const cardEl = document.createElement('div');
        cardEl.className = 'opponent-card-back';
        cardEl.style.backgroundImage = "url('assets/card_back.png')";
        
        const rot = (Math.random() * 14) - 7; // -7 to +7 degrees variance
        cardEl.style.setProperty('--rot-offset', `${rot}deg`);
        cardEl.style.zIndex = i;
        // Animation is handled entirely through the idle-float keyframes in CSS
        
        handEl.appendChild(cardEl);
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

    const total = battleState.player.hand.length;
    
    // === НАСТРОЙКИ ВЕЕРА ===
    // Уменьшили угол, чтобы карты не так сильно наклонялись (было 18, стало 8)
    const maxAngle = 8; 
    const angleStep = total > 1 ? (maxAngle * 2) / (total - 1) : 0;
    const startAngle = -maxAngle;

    battleState.player.hand.forEach((card, index) => {
        const cardEl = buildBattleCard(card);
        const canPlay = battleState.turn === 'player' && card.cost <= battleState.player.energy;
        
        if (!canPlay) cardEl.classList.add('disabled');
        cardEl.onclick = () => playCardFromHand(card.uid);
        
        // Считаем угол для текущей карты
        const rotation = total > 1 ? startAngle + (index * angleStep) : 0;
        
        // === ПЛОСКАЯ ДУГА ===
        // Убрали сильное закругление. Теперь карты сдвигаются вниз совсем чуть-чуть.
        // Если хочешь еще ровнее, поменяй 1.5 на 0.5 или 1.
        const yOffset = Math.abs(rotation) * 1.5; 
        
        cardEl.style.transform = `rotate(${rotation}deg) translateY(${yOffset}px)`;
        cardEl.style.zIndex = index + 1;
        
        handEl.appendChild(cardEl);
    });
}

function buildBattleCard(card) {
    const el = document.createElement('div');
    el.className = 'card battle-card';
    
    // Цвет рамки по редкости
    if (typeof getRarityColor === 'function') {
        el.style.borderColor = getRarityColor(card.rarity);
    }
    
    const cleanUrl = encodeURI((card.image || '').trim());

    el.innerHTML = `
        <div class="card-art">
            <img src="${cleanUrl}" alt="${card.name}">
        </div>

        <div class="card-top-bar">
            <div class="card-cost-wrap">
                <div class="card-cost-icon">${typeof SVG_SHURIKEN !== 'undefined' ? SVG_SHURIKEN : '⭐'}</div>
                <span class="card-cost-num">${card.cost}</span>
            </div>
            <div class="card-name">${card.name}</div>
        </div>

        <div class="card-bottom-bar">
            <div class="card-stat card-atk">
                <div class="card-stat-icon">${typeof SVG_KUNAI !== 'undefined' ? SVG_KUNAI : '⚔️'}</div>
                <span class="card-stat-num">${card.attack}</span>
            </div>
            <div class="card-clan">
                ${typeof getClanIcon === 'function' ? getClanIcon(card.clan) : ''}
            </div>
            <div class="card-stat card-def">
                <div class="card-stat-icon">${typeof SVG_SHIELD !== 'undefined' ? SVG_SHIELD : '🛡️'}</div>
                <span class="card-stat-num battle-hp-value">${card.currentHp || card.defense}</span>
            </div>
        </div>
    `;

    // Правый клик — предпросмотр
    el.oncontextmenu = (e) => {
        e.preventDefault();
        if (typeof showBigCardPreview === 'function') showBigCardPreview(card);
    };

    return el;
}

function showBigCardPreview(card) {
    let overlay = document.getElementById('card-preview-overlay');
    
    // Создаем оверлей, если его еще нет на странице
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'card-preview-overlay';
        overlay.className = 'card-preview-overlay hidden';
        
        // Закрываем окно на любой клик (ЛКМ или ПКМ)
        overlay.onclick = () => overlay.classList.add('hidden');
        overlay.oncontextmenu = (e) => { e.preventDefault(); overlay.classList.add('hidden'); };
        
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = ''; // Очищаем прошлую карту
    
    // Создаем "копию" данных карты, но подменяем базовую защиту (defense) 
    // на текущее ХП в бою (currentHp), чтобы на большой карте отражался урон!
    const previewData = { ...card, defense: card.currentHp };
    
    // Используем функцию из cards.js, которая рисует ИДЕАЛЬНЫЕ большие карты
    const bigCard = createCardElement(previewData, { owned: true });
    
    // Отключаем лишние клики на самой карте и вешаем спец-класс
    bigCard.oncontextmenu = null;
    bigCard.onclick = null;
    bigCard.classList.add('preview-mode');
    
    // Маленькая фишка: если карта ранена, делаем текст ХП на большой карте красным
    if (card.currentHp < card.defense) {
        const hpSpan = bigCard.querySelector('.card-def .card-stat-num');
        if (hpSpan) {
            hpSpan.style.color = '#ff4d4d';
            hpSpan.style.textShadow = '0 0 5px #ff0000, 0 1px 4px #000';
        }
    }
    
    overlay.appendChild(bigCard);
    overlay.classList.remove('hidden');
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

// --- 8. SURRENDER CONFIRMATION OVERLAY ---

function showSurrenderConfirmation() {
    let overlay = document.getElementById('surrender-confirm-overlay');
    
    // Create the overlay dynamically if it doesn't exist yet
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'surrender-confirm-overlay';
        overlay.className = 'card-preview-overlay'; // Reuse your existing overlay class
        
        // Inline fallback styling to ensure it centers correctly
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const modal = document.createElement('div');
        modal.style.background = '#1a1a1a';
        modal.style.border = '2px solid #ff4d4d';
        modal.style.padding = '30px 40px';
        modal.style.borderRadius = '12px';
        modal.style.textAlign = 'center';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        
        const title = document.createElement('h2');
        title.innerText = 'Are you sure you want to surrender?';
        title.style.color = '#fff';
        title.style.marginBottom = '25px';
        title.style.fontFamily = 'sans-serif';
        
        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '20px';
        btnWrap.style.justifyContent = 'center';
        
        // CONFIRM BUTTON
        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = 'Surrender';
        btnConfirm.style.padding = '10px 20px';
        btnConfirm.style.background = '#ff4d4d';
        btnConfirm.style.color = '#fff';
        btnConfirm.style.border = 'none';
        btnConfirm.style.borderRadius = '5px';
        btnConfirm.style.cursor = 'pointer';
        btnConfirm.style.fontWeight = 'bold';
        btnConfirm.onclick = () => {
            overlay.style.display = 'none';
            exitBattle(); // Call the original exit logic
        };
        
        // CANCEL BUTTON
        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Cancel';
        btnCancel.style.padding = '10px 20px';
        btnCancel.style.background = '#555';
        btnCancel.style.color = '#fff';
        btnCancel.style.border = 'none';
        btnCancel.style.borderRadius = '5px';
        btnCancel.style.cursor = 'pointer';
        btnCancel.style.fontWeight = 'bold';
        btnCancel.onclick = () => {
            overlay.style.display = 'none'; // Hide overlay
        };
        
        btnWrap.appendChild(btnCancel);
        btnWrap.appendChild(btnConfirm);
        
        modal.appendChild(title);
        modal.appendChild(btnWrap);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }
    
    // Show the overlay
    overlay.style.display = 'flex';
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    const btnPractice = document.getElementById('btn-practice');
    if (btnPractice) {
        btnPractice.onclick = async () => await startPracticeMatch();
    }

    const btnExitBattle = document.getElementById('btn-exit-battle');
    if (btnExitBattle) {
        // OVERRIDE: Show confirmation instead of immediate exit
        btnExitBattle.onclick = () => showSurrenderConfirmation();
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