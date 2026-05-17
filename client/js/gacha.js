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
    const gachaMoneyEl = document.getElementById('gacha-user-money'); // Синхронизируем новый элемент баланса гачи
    const safeAmount = Number(amount) || 0;
    
    currentMoney = safeAmount; 
    
    if (moneyEl) moneyEl.innerText = safeAmount;
    if (shopMoneyEl) shopMoneyEl.innerText = safeAmount;
    if (gachaMoneyEl) gachaMoneyEl.innerText = safeAmount;
    
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

window.setUserMoney = updateMoneyUI;
window.refreshBalance = refreshBalance;

function updateGachaPriceLabels() {
    if (btnGachaOpen) btnGachaOpen.innerText = `Open x1 (⛩️ 100)`;
    if (btnGachaOpen10) {
        btnGachaOpen10.innerHTML = `Ritual x5 (⛩️ 450) <span class="sale-badge">SALE -10%</span>`;
    }
}

function setGachaButtonsDisabled(disabled) {
    [btnGachaOpen, btnGachaOpen10, btnGachaFlip, btnGachaReset].forEach(btn => {
        if (btn) btn.disabled = disabled;
    });
}

function clearGachaBeam() {
    if (!gachaBeam) return;
    gachaBeam.className = 'gacha-beam';
    const ring = document.getElementById('gacha-flash-ring');
    if (ring) ring.className = 'gacha-flash-ring';
}

function resetGachaUI() {
    if (gachaStage) {
        gachaStage.className = 'gacha-stage';
    }
    if (gachaCards) {
        gachaCards.innerHTML = '';
        gachaCards.className = 'gacha-cards-grid-fan';
    }
    
    clearGachaBeam();
    
    if (gachaHint) gachaHint.innerText = 'Grab the golden knot and pull down to invoke the ritual';
    if (omamori) {
        omamori.style.transform = '';
        omamori.className = 'omamori-wrapper';
    }
    
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
    cardEl.className = 'gacha-card-item'; 

    const cardImage = card.avatar_url || card.image || '';
    const cleanUrl = encodeURI((cardImage || '').trim());

    const shurikenIcon = SVG_SHURIKEN || '';
    const kunaiIcon = SVG_KUNAI || '';
    const shieldIcon = SVG_SHIELD || '';
    
    const clanHtml = typeof getClanIcon === 'function' ? getClanIcon(card.clan) : `<span>${card.clan || ''}</span>`;

    cardEl.innerHTML = `
        <div class="gacha-card-item-inner">
            <div class="gacha-card-side side-back"></div>
            <div class="gacha-card-side side-front card battle-card ${card.rarity || 'common'}" data-id="${card.id}">
                <div class="card-art">
                    <img src="${cleanUrl}" alt="${card.name}">
                </div>
                <div class="card-top-bar">
                    <div class="card-cost-wrap">
                        <div class="card-cost-icon">${shurikenIcon}</div>
                        <span class="card-cost-num">${card.cost || 0}</span>
                    </div>
                    <div class="card-name">${card.name}</div>
                </div>
                <div class="card-bottom-bar">
                    <div class="card-stat card-atk">
                        <div class="card-stat-icon">${kunaiIcon}</div>
                        <span class="card-stat-num">${card.attack}</span>
                    </div>
                    <div class="card-clan">
                        ${clanHtml}
                    </div>
                    <div class="card-stat card-def">
                        <div class="card-stat-icon">${shieldIcon}</div>
                        <span class="card-stat-num">${card.defense}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Клик на саму карту больше ничего не делает, чтобы не ломать логику пака
    return cardEl;
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Новая функция рендеринга 5 стопок (3 сверху, 2 снизу)
function renderGachaCards(cards) {
    if (!gachaCards) return;
    gachaCards.innerHTML = '';
    
    const isMulti = cards.length > 5; // Если карт больше 5 (например, 25), включаем режим 5 стопок
    
    if (!isMulti) {
        // Одиночный пак (1 пак из 5 карт) — рендерим как обычный красивый одиночный веер
        gachaCards.className = 'gacha-cards-grid-fan single-pack';
        renderSingleFan(cards, gachaCards, 0);
    } else {
        // МУЛЬТИ-ПАК: Разбиваем 25 карт на 5 паков по 5 карт
        gachaCards.className = 'gacha-multi-packs-container';
        
        const packs = chunkArray(cards, 5);
        
        packs.forEach((packCards, packIndex) => {
            // Создаем отдельный контейнер-стопку для каждого пака
            const packStack = document.createElement('div');
            packStack.className = `gacha-pack-stack pack-position-${packIndex}`;
            
            // Рендерим 5 карт внутрь этого конкретного пака
            renderSingleFan(packCards, packStack, packIndex);
            
            gachaCards.appendChild(packStack);
        });
    }
}

function renderSingleFan(cards, container, packIndex) {
    const total = cards.length;
    const maxAngle = total > 3 ? 12 : 5; 
    const angleStep = total > 1 ? (maxAngle * 2) / (total - 1) : 0;
    const startAngle = -maxAngle;

    const generatedCards = [];

    cards.forEach((card, index) => {
        const cardEl = buildGachaCard(card);
        
        const rot = startAngle + (index * angleStep);
        const yOffset = Math.abs(rot) * 1.5; 
        const xOffset = (index - (total - 1) / 2) * 35; 
        
        cardEl.style.setProperty('--fan-rot', `${rot}deg`);
        cardEl.style.setProperty('--fan-y', `${yOffset}px`);
        cardEl.style.setProperty('--fan-x', `${xOffset}px`);

        container.appendChild(cardEl);
        generatedCards.push(cardEl);
        
        // Вылет карт рубашкой вверх
        setTimeout(() => {
            cardEl.classList.add('fly-in');
        }, (packIndex * 120) + (index * 25));
    });

    // Обозначаем, что стопка изначально закрыта
    container.classList.add('is-sealed');

    // КЛИК ПО ВСЕЙ СТОПКЕ (ВЕЕРУ) ДЛЯ РАСКРЫТИЯ ПАКА
    container.onclick = (e) => {
        // Если пак уже открыт — ничего не делаем
        if (!container.classList.contains('is-sealed')) return;
        
        // Убираем состояние закрытого пака и добавляем импульс взрыва
        container.classList.remove('is-sealed');
        container.classList.add('pack-exploding');
        
        // Каскадно переворачиваем только 5 карт этой конкретной стопки
        let currentDelay = 0;
        generatedCards.forEach((cardEl) => {
            const frontSide = cardEl.querySelector('.side-front');
            const rarity = frontSide ? frontSide.className : 'common';
            
            let stepDelay = 120;
            if (rarity.includes('legendary')) stepDelay = 350;
            else if (rarity.includes('epic')) stepDelay = 220;

            currentDelay += stepDelay;

            setTimeout(() => {
                if (!cardEl.classList.contains('flipped') && !gachaStage.classList.contains('resetting')) {
                    cardEl.classList.add('flipped');
                }
            }, currentDelay);
        });
        
        // Убираем класс взрыва после завершения анимации
        setTimeout(() => {
            container.classList.remove('pack-exploding');
        }, 800);
    };
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
    
    cardDatabase = cardDatabase.map(card => (
        ownedIds.has(card.id) ? { ...card, owned: true } : card
    ));
    
    const deckBuilder = document.getElementById('deck-builder');
    if (typeof hasLoadedCollection !== 'undefined' && hasLoadedCollection && deckBuilder && !deckBuilder.classList.contains('hidden')) {
        if (typeof renderDeckBuilder === 'function') renderDeckBuilder();
    }
}

// --- SERVER INTERACTION ---

async function requestGachaOpen(count) {
    if (gachaState.opening) return;
    
    // Пересчитываем стоимость под новые правила: х1 = 100, х5 = 450
    const totalCost = count >= 5 ? 450 : 100 * count;
    
    if (typeof currentMoney !== 'undefined' && currentMoney < totalCost) {
        if (gachaHint) gachaHint.innerText = 'Insufficient currency balance for ritual';
        return;
    }
    
    gachaState.opening = true;
    setGachaButtonsDisabled(true);
    
    if (gachaHint) gachaHint.innerText = 'Invoking sacred patterns...';
    if (gachaStage) gachaStage.className = 'gacha-stage opening-active';
    if (omamori) omamori.className = 'omamori-wrapper shake-ritual-loop';
    if (gachaCards) gachaCards.innerHTML = '';
    clearGachaBeam();

    try {
        const sendCount = count >= 5 ? 5 : 1;
        const res = await fetch('/api/gacha/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: sendCount })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Ritual invocation failed');

        setTimeout(() => {
            if (omamori) omamori.className = 'omamori-wrapper break-seal-disappear';
            
            const ring = document.getElementById('gacha-flash-ring');
            if (ring) ring.className = `gacha-flash-ring pulse-trigger ${getHighestRarity(data.cards || [])}`;
            
            if (gachaBeam) gachaBeam.className = `gacha-beam visible ${getHighestRarity(data.cards || [])}`;

            setTimeout(() => {
                if (gachaStage) gachaStage.className = 'gacha-stage ritual-revealed';
                renderGachaCards(data.cards || []);
                
                const newCards = getNewCards(data.cards || []);
                if (gachaHint) {
                    gachaHint.innerText = newCards.length > 0
                        ? `Sacred Ties Bound! New legends: ${newCards.length}`
                        : 'Ritual Complete. Cards added to your collection.';
                }
                
                markOwnedCards(data.cards || []);
                if (data.balance !== undefined) updateMoneyUI(data.balance);
                
                gachaState.opening = false;
                setGachaButtonsDisabled(false);
            }, 550);

        }, 1100);
        
    } catch (error) {
        if (gachaHint) gachaHint.innerText = error.message || 'Ritual execution aborted';
        resetGachaUI();
    }
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    updateGachaPriceLabels();

    if (btnGachaOpen) {
        btnGachaOpen.onclick = () => requestGachaOpen(1);
    }

    if (btnGachaOpen10) btnGachaOpen10.onclick = () => requestGachaOpen(5); 

    if (btnGachaFlip) {
    btnGachaFlip.onclick = () => {
        if (!gachaCards) return;
        
        // Находим вообще все карты на сцене Гачи
        const allCards = gachaCards.querySelectorAll('.gacha-card-item');
        
        allCards.forEach((card, index) => {
            // Переворачиваем волнообразно (каждые 60мс новая карта), только если она закрыта
            setTimeout(() => {
                if (!card.classList.contains('flipped') && !gachaStage.classList.contains('resetting')) {
                    card.classList.add('flipped');
                }
            }, index * 60); 
        });
    };
}

    if (btnGachaReset) {
        btnGachaReset.onclick = () => resetGachaUI();
    }

    // Логика интерактивного вытягивания (Pull Down) Омамори за Золотой Узел
    if (omamoriKnot && omamori) {
        omamoriKnot.addEventListener('pointerdown', (event) => {
            if (gachaState.opening) return;
            gachaState.dragging = true;
            gachaState.startY = event.clientY;
            omamoriKnot.setPointerCapture(event.pointerId);
            omamori.classList.add('dragging-active');
        });

        omamoriKnot.addEventListener('pointermove', (event) => {
            if (!gachaState.dragging || gachaState.opening) return;
            
            const delta = Math.max(0, event.clientY - gachaState.startY);
            const clamped = Math.min(delta, 140);
            
            // Плавное натяжение и скейлинг амулета вниз
            omamori.style.transform = `translateY(${clamped}px) scaleX(${1 - clamped * 0.0008})`;
            
            if (delta > 85) {
                gachaState.dragging = false;
                omamori.classList.remove('dragging-active');
                omamori.style.transform = '';
                requestGachaOpen(1);
            }
        });

        const stopDrag = () => {
            if (!gachaState.dragging) return;
            gachaState.dragging = false;
            omamori.classList.remove('dragging-active');
            omamori.style.transform = '';
        };

        omamoriKnot.addEventListener('pointerup', stopDrag);
        omamoriKnot.addEventListener('pointercancel', stopDrag);
        omamoriKnot.addEventListener('pointerleave', stopDrag);
    }
});

window.resetGachaUI = resetGachaUI;