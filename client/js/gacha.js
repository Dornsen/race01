/* =========================================
   GACHA.JS - PACK OPENING & OMAMORI ANIMATIONS
   ========================================= */

// --- DOM ELEMENTS ---
const gachaStage = document.getElementById('gacha-stage');
const gachaBeam = document.getElementById('gacha-beam');
const gachaCards = document.getElementById('gacha-cards');
const gachaHint = document.getElementById('gacha-hint');
const omamori = document.getElementById('omamori');
const omamoriKnot = document.getElementById('omamori-knot');

const btnGachaOpen = document.getElementById('btn-gacha-open');
const btnGachaOpen10 = document.getElementById('btn-gacha-open-10');
const btnGachaFlip = document.getElementById('btn-gacha-flip');
const btnGachaReset = document.getElementById('btn-gacha-reset');

// --- STATE ---
const gachaState = {
    opening: false,
    dragging: false,
    startY: 0
};

// --- UI HELPERS ---

function updateMoneyUI(amount) {
    const moneyEl = document.getElementById('user-money');
    const shopMoneyEl = document.getElementById('shop-money');
    const safeAmount = Number(amount) || 0;
    
    currentMoney = safeAmount; // Обновляем глобальную переменную (из globals.js)
    
    if (moneyEl) moneyEl.innerText = safeAmount;
    if (shopMoneyEl) shopMoneyEl.innerText = safeAmount;
    
    if (typeof updateGachaPriceLabels === 'function') {
        updateGachaPriceLabels();
    }
}

async function refreshBalance() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data && data.isLoggedIn && data.user && data.user.money !== undefined) {
            updateMoneyUI(data.user.money);
        }
    } catch (e) {
        console.warn('Balance refresh failed', e);
    }
}

// Делаем функции глобальными, чтобы они были доступны из других файлов (например, из navigation.js)
window.setUserMoney = updateMoneyUI;
window.refreshBalance = refreshBalance;

function updateGachaPriceLabels() {
    const gachaConfig = (window.GAME_CONFIG && window.GAME_CONFIG.gacha) || {};
    const packCost = gachaConfig.packCost || 100;
    const packCost10 = gachaConfig.packCost10 || 900;
    
    if (btnGachaOpen) btnGachaOpen.innerText = `Open (⛩️ ${packCost})`;
    if (btnGachaOpen10) btnGachaOpen10.innerText = `Ritual x10 (⛩️ ${packCost10})`;
}

function setGachaButtonsDisabled(disabled) {
    [btnGachaOpen, btnGachaOpen10, btnGachaFlip, btnGachaReset].forEach(btn => {
        if (btn) btn.disabled = disabled;
    });
}

function clearGachaBeam() {
    if (!gachaBeam) return;
    gachaBeam.className = 'gacha-beam';
}

function resetGachaUI() {
    if (gachaStage) {
        gachaStage.classList.remove('opening', 'revealed');
        gachaStage.classList.remove('count-5', 'count-10');
    }
    if (gachaCards) gachaCards.innerHTML = '';
    
    clearGachaBeam();
    
    if (gachaHint) gachaHint.innerText = 'Grab the knot and pull down';
    if (omamori) omamori.style.transform = '';
    
    gachaState.opening = false;
    setGachaButtonsDisabled(false);
}

// --- CARD PROCESSING & RENDERING ---

function getHighestRarity(cards) {
    const order = ['common', 'rare', 'epic', 'legendary'];
    let maxIndex = 0;
    cards.forEach(card => {
        const idx = order.indexOf(card.rarity);
        if (idx > maxIndex) maxIndex = idx;
    });
    return order[maxIndex];
}

function buildGachaCard(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'gacha-card';

    const cardImage = card.avatar_url || card.image || '';
    const inner = document.createElement('div');
    inner.className = 'gacha-card-inner';

    const back = document.createElement('div');
    back.className = 'gacha-card-face gacha-card-back';
    back.innerText = '✦';

    const front = document.createElement('div');
    front.className = `gacha-card-face gacha-card-front ${card.rarity}`;
    front.innerHTML = `
        <div class="gacha-card-title">${card.name}</div>
        <div class="gacha-card-rarity">${card.rarity}</div>
        <div class="gacha-card-art">
            <img src="${encodeURI(cardImage.trim())}" alt="${card.name}">
        </div>
        <div class="gacha-card-stats">
            <span>⚔️ ${card.attack}</span>
            <span>🛡️ ${card.defense}</span>
        </div>
    `;

    inner.appendChild(back);
    inner.appendChild(front);
    cardEl.appendChild(inner);

    cardEl.onclick = () => {
        cardEl.classList.toggle('flipped');
    };

    return cardEl;
}

function renderGachaCards(cards) {
    if (!gachaCards) return;
    gachaCards.innerHTML = '';
    
    cards.forEach((card, index) => {
        const cardEl = buildGachaCard(card);
        gachaCards.appendChild(cardEl);
        // Staggered reveal animation
        setTimeout(() => cardEl.classList.add('reveal'), 80 * index);
    });
}

function getNewCards(cards) {
    if (typeof cardDatabase === 'undefined' || cardDatabase.length === 0) return [];
    
    const ownedSet = new Set(cardDatabase.filter(card => card.owned).map(card => card.id));
    const newSet = new Set();
    
    cards.forEach(card => {
        if (!ownedSet.has(card.id)) newSet.add(card.id);
    });
    
    return cards.filter(card => newSet.has(card.id)).filter((card, index, arr) => (
        arr.findIndex(item => item.id === card.id) === index
    ));
}

function markOwnedCards(cards) {
    if (typeof cardDatabase === 'undefined' || cardDatabase.length === 0) return;
    
    const ownedIds = new Set(cards.map(card => card.id));
    
    // Update global cardDatabase (assumes globals.js is loaded)
    cardDatabase = cardDatabase.map(card => (
        ownedIds.has(card.id) ? { ...card, owned: true } : card
    ));
    
    // Re-render deck builder if it's currently open
    const deckBuilder = document.getElementById('deck-builder');
    if (typeof hasLoadedCollection !== 'undefined' && hasLoadedCollection && deckBuilder && !deckBuilder.classList.contains('hidden')) {
        if (typeof renderDeckBuilder === 'function') renderDeckBuilder();
    }
}

// --- SERVER INTERACTION ---

async function requestGachaOpen(count) {
    if (gachaState.opening) return;
    
    const gachaConfig = (window.GAME_CONFIG && window.GAME_CONFIG.gacha) || {};
    const packCost = gachaConfig.packCost || 100;
    const packCost10 = gachaConfig.packCost10 || 900;
    const totalCost = count >= 10 ? packCost10 : packCost * count;
    
    if (typeof currentMoney !== 'undefined' && currentMoney < totalCost) {
        if (gachaHint) gachaHint.innerText = 'Not enough currency';
        return;
    }
    
    gachaState.opening = true;
    setGachaButtonsDisabled(true);
    
    if (gachaHint) gachaHint.innerText = 'Opening pack...';
    if (gachaStage) gachaStage.classList.remove('revealed');
    if (gachaCards) gachaCards.innerHTML = '';
    clearGachaBeam();

    try {
        const res = await fetch('/api/gacha/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to open pack');

        if (gachaStage) {
            gachaStage.classList.add('opening');
            gachaStage.classList.remove('count-5', 'count-10');
            gachaStage.classList.add(count >= 10 ? 'count-10' : 'count-5');
        }
        
        const rarity = getHighestRarity(data.cards || []);
        if (gachaBeam) {
            gachaBeam.className = `gacha-beam visible ${rarity}`;
        }

        // Wait for omamori shaking animation to finish before revealing cards
        setTimeout(() => {
            renderGachaCards(data.cards || []);
            if (gachaStage) gachaStage.classList.add('revealed');
            
            const newCards = getNewCards(data.cards || []);
            if (gachaHint) {
                gachaHint.innerText = newCards.length > 0
                    ? `New cards: ${newCards.length}`
                    : 'No new cards';
            }
            
            markOwnedCards(data.cards || []);
            
            if (data.balance !== undefined && typeof window.setUserMoney === 'function') {
                window.setUserMoney(data.balance);
            }
            
            gachaState.opening = false;
            setGachaButtonsDisabled(false);
        }, 700);
        
    } catch (error) {
        if (gachaHint) gachaHint.innerText = error.message || 'Failed to open pack';
        gachaState.opening = false;
        setGachaButtonsDisabled(false);
    }
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    updateGachaPriceLabels();

    if (btnGachaOpen) {
        btnGachaOpen.onclick = () => requestGachaOpen(1);
    }

    if (btnGachaOpen10) {
        btnGachaOpen10.onclick = () => requestGachaOpen(10);
    }

    if (btnGachaFlip) {
        btnGachaFlip.onclick = () => {
            if (!gachaCards) return;
            gachaCards.querySelectorAll('.gacha-card').forEach(card => {
                card.classList.add('flipped');
            });
        };
    }

    if (btnGachaReset) {
        btnGachaReset.onclick = () => resetGachaUI();
    }

    // Omamori Drag Animation Logic
    if (omamoriKnot && omamori) {
        omamoriKnot.addEventListener('pointerdown', (event) => {
            if (gachaState.opening) return;
            gachaState.dragging = true;
            gachaState.startY = event.clientY;
            omamoriKnot.setPointerCapture(event.pointerId);
        });

        omamoriKnot.addEventListener('pointermove', (event) => {
            if (!gachaState.dragging || gachaState.opening) return;
            
            const delta = Math.max(0, event.clientY - gachaState.startY);
            const clamped = Math.min(delta, 120);
            omamori.style.transform = `translateY(${clamped}px)`;
            
            // Trigger opening if pulled far enough
            if (delta > 70) {
                gachaState.dragging = false;
                omamori.style.transform = '';
                requestGachaOpen(1);
            }
        });

        const stopDrag = () => {
            if (!gachaState.dragging) return;
            gachaState.dragging = false;
            omamori.style.transform = '';
        };

        omamoriKnot.addEventListener('pointerup', stopDrag);
        omamoriKnot.addEventListener('pointercancel', stopDrag);
        omamoriKnot.addEventListener('pointerleave', stopDrag);
    }
});

// Expose reset UI to window so navigation.js can reset it when leaving the screen
window.resetGachaUI = resetGachaUI;