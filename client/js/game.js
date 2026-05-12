let cardDatabase = []; // Все карты в игре
let myDeck = [];       // Карты, выбранные игроком
const MAX_DECK_SIZE = 10;
let hasLoadedCollection = false;
let hasLoadedDeck = false;
let activeCardModal = null;
const collectionFilters = {
    ownedOnly: false,
    rarity: 'all',
    costMin: '',
    costMax: '',
    search: ''
};

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

function createCardElement(cardData, options = {}) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.style.borderColor = getRarityColor(cardData.rarity);
    cardEl.setAttribute('data-id', cardData.id);
    cardEl.setAttribute('data-cost', cardData.cost);

    const isOwned = options.owned !== false;
    const inDeck = options.inDeck === true;

    if (!isOwned) cardEl.classList.add('card-locked');
    if (inDeck) cardEl.classList.add('card-in-deck');
    
    // Очищаем путь от любых невидимых пробелов и переносов строк из БД
    const cleanUrl = encodeURI(cardData.image.trim());

    // Вместо background-image используем 100% надежный тег <img>
    cardEl.innerHTML = `
        <div class="card-cost" style="background: ${getRarityColor(cardData.rarity)}">${cardData.cost}</div>
        <div class="card-title">${cardData.name}</div>
        <button class="card-info-btn" type="button" aria-label="Подробнее">i</button>
        
        <div class="card-art" style="background-color: #2c3e50; overflow: hidden; display: flex; justify-content: center; align-items: center;">
            <img src="${cleanUrl}" alt="${cardData.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        
        <div class="card-stats">
            <span class="attack">⚔️ ${cardData.attack}</span>
            <span class="defense">🛡️ ${cardData.defense}</span>
        </div>
        ${isOwned ? '' : '<div class="card-locked-overlay">Нет карты</div>'}
    `;

    const infoBtn = cardEl.querySelector('.card-info-btn');
    if (infoBtn) {
        infoBtn.onclick = (e) => {
            e.stopPropagation();
            showCardDetails(cardData);
        };
    }

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
        collectionCount.innerText = `Коллекция: ${ownedCount} / ${cardDatabase.length}`;
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
    if (myDeck.length >= MAX_DECK_SIZE) return showNotification(`Максимум ${MAX_DECK_SIZE} карт!`, true);
    if (myDeck.some(c => c.id === card.id)) return showNotification('Эта карта уже в колоде!', true);
    
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
            return showNotification(`Собери ровно ${MAX_DECK_SIZE} карт! (У тебя: ${myDeck.length})`, true);
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
            showNotification('Ошибка сохранения', true);
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
    if (card.description) parts.push(`<div><strong>Описание:</strong> ${card.description}</div>`);
    if (card.ability) parts.push(`<div><strong>Способность:</strong> ${card.ability}</div>`);
    if (card.clan) parts.push(`<div><strong>Клан:</strong> ${card.clan}</div>`);
    parts.push(`<div><strong>Статы:</strong> ⚔️ ${card.attack} / 🛡️ ${card.defense} / 💠 ${card.cost}</div>`);

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