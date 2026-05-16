/* =========================================
   DECK.JS - DECK BUILDER & COLLECTION LOGIC
   ========================================= */

// --- 1. DATA FETCHING ---

async function fetchCardsFromDB() {
    try {
        const res = await fetch('/api/cards/collection');
        const data = await res.json();
        
        if (res.ok) {
            // Map DB response to our local card format
            cardDatabase = data.cards.map(c => ({
                id: c.id, 
                name: c.name, 
                cost: c.cost, 
                attack: c.attack, 
                defense: c.defense, 
                rarity: c.rarity, 
                image: c.avatar_url,
                owned: !!c.owned,
                description: c.description,
                ability: c.ability_description,
                clan: c.clan
            }));
            hasLoadedCollection = true;
        }
    } catch (e) { 
        console.error("Error loading card database:", e); 
    }
}

async function fetchMyDeck() {
    try {
        const res = await fetch('/api/decks/mine');
        const data = await res.json();
        const deckCountEl = document.getElementById('deck-count');

        if (res.ok && data.deck) {
            myDeck = data.deck.map(c => ({
                id: c.id, 
                name: c.name, 
                cost: c.cost, 
                attack: c.attack, 
                defense: c.defense, 
                rarity: c.rarity, 
                image: c.avatar_url,
                description: c.description,
                ability: c.ability_description,
                clan: c.clan
            }));
            hasLoadedDeck = true;
            if (deckCountEl) deckCountEl.innerText = myDeck.length;
        } else if (res.ok) {
            // Handle empty deck
            myDeck = [];
            hasLoadedDeck = true;
            if (deckCountEl) deckCountEl.innerText = '0';
        }
    } catch (e) { 
        console.error("Error loading player deck:", e); 
    }
}

// --- 2. DECK MODIFICATION ---

function addToDeck(card) {
    if (myDeck.length >= MAX_DECK_SIZE) {
        return showNotification(`Max ${MAX_DECK_SIZE} cards allowed!`, true);
    }
    if (myDeck.some(c => c.id === card.id)) {
        return showNotification('Card is already in the deck!', true);
    }
    
    myDeck.push(card);
    renderDeckBuilder();
}

function removeFromDeck(index) {
    myDeck.splice(index, 1);
    renderDeckBuilder();
}

// --- 3. RENDERING ---

function renderDeckBuilder() {
    const colGrid = document.getElementById('collection-grid');
    const deckGrid = document.getElementById('current-deck-grid');
    const collectionCount = document.getElementById('collection-count');
    const deckCountEl = document.getElementById('deck-count');
    
    if (!colGrid || !deckGrid) return;

    colGrid.innerHTML = '';
    deckGrid.innerHTML = '';

    // Render Left Panel (Collection)
    const ownedCount = cardDatabase.filter(card => card.owned).length;
    if (collectionCount) {
        collectionCount.innerText = `Collection: ${ownedCount} / ${cardDatabase.length}`;
    }

    // Apply active filters
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

    // Populate Left Panel (Collection)
    filteredCards.forEach(card => {
        const isInDeck = myDeck.some(c => c.id === card.id);
        const cardDOM = createCardElement(card, { owned: card.owned, inDeck: isInDeck });

        // Управляем кликом без pointer-events, чтобы не ломать ПКМ
        cardDOM.onclick = () => {
            if (card.owned && !isInDeck) {
                addToDeck(card);
            }
        };

        if (!card.owned || isInDeck) {
            cardDOM.style.cursor = 'not-allowed';
        }
        
        // Клик ПКМ на карту в коллекции
        cardDOM.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showDeckCardPreview(card);
        };

        colGrid.appendChild(cardDOM);
    });

    // Populate Right Panel (Current Deck)
    myDeck.forEach((card, index) => {
        const cardDOM = createCardElement(card, { owned: true, inDeck: true });
        
        cardDOM.onclick = () => removeFromDeck(index);
        
        // Клик ПКМ на карту в вашей деке
        cardDOM.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showDeckCardPreview(card);
        };
        
        deckGrid.appendChild(cardDOM);
    });

    if (deckCountEl) {
    deckCountEl.innerText = myDeck.length;
}
}

// --- 4. FILTERS LOGIC ---

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

// --- 5. SAVE DECK TO SERVER ---

document.addEventListener('DOMContentLoaded', () => {
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
                
                if (typeof showNotification === 'function') {
                    showNotification(result.message || result.error, res.ok ? 'success' : 'error');
                }
            } catch (e) {
                if (typeof showNotification === 'function') showNotification('Save failed', true);
            } finally {
                btnSaveDeck.innerText = prevText;
                btnSaveDeck.disabled = false;
            }
        };
    }
});

// Expose functions to the global window object so navigation.js can use them
window.fetchCardsFromDB = fetchCardsFromDB;
window.fetchMyDeck = fetchMyDeck;
window.renderDeckBuilder = renderDeckBuilder;
window.wireCollectionFilters = wireCollectionFilters;

function showDeckCardPreview(card) {
    // 1. Вызываем стандартное открытие текстового окна вашей игры
    if (typeof showCardDetails === 'function') {
        showCardDetails(card);
    }

    // 2. Находим главный оверлей модалки (черный размытый фон)
    const modalOverlay = document.getElementById('card-detail-modal');
    if (!modalOverlay) return;

    // Сделаем сам оверлей флекс-контейнером, чтобы центрировать текстовый блок и карту рядом
    modalOverlay.style.display = 'flex';
    modalOverlay.style.flexDirection = 'row';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.gap = '40px'; // Расстояние между старым окном и картой

    // 3. Проверяем и удаляем старое превью карты, если оно висит в оверлее
    const oldSidePreview = modalOverlay.querySelector('.separate-card-preview');
    if (oldSidePreview) {
        oldSidePreview.remove();
    }

    // 4. Создаем новый отдельный контейнер для визуальной карты
    const separatePreview = document.createElement('div');
    separatePreview.className = 'separate-card-preview';

    // 5. Генерируем карту точно так же, как в бою
    const cardDOM = createCardElement(card, { owned: true });
    cardDOM.onclick = null; // Отключаем обработку левого клика на превью
    cardDOM.oncontextmenu = (e) => e.preventDefault(); // Отключаем стандартное меню хрома на превью

    separatePreview.appendChild(cardDOM);

    // 6. Добавляем карту прямо в оверлей, она встанет справа от текстового блока
    modalOverlay.appendChild(separatePreview);
}

// Экспортируем функцию в глобальную видимость
window.showDeckCardPreview = showDeckCardPreview;