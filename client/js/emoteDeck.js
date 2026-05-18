const EMOTE_DECK_SIZE = 8;

async function loadAllEmotes() {
    try {
        const res = await fetch('/api/emotes/all');
        if (!res.ok) return [];
        const data = await res.json();
        return data.emotes || [];
    } catch (e) { console.error('loadAllEmotes', e); return []; }
}

async function loadOwnedEmotes() {
    try {
        const res = await fetch('/api/emotes');
        if (!res.ok) return [];
        const data = await res.json();
        return data.emotes || [];
    } catch (e) { console.error('loadOwnedEmotes', e); return []; }
}

async function loadUserEmoteDeck() {
    try {
        const res = await fetch('/api/emotes/deck');
        if (!res.ok) return [];
        const data = await res.json();
        return data.deck || [];
    } catch (e) { console.error('loadUserEmoteDeck', e); return []; }
}

function renderEmoteGrid(container, emotes, onClick, selectedIds = new Set(), forceDisabled = false) {
    container.innerHTML = '';
    emotes.forEach(e => {
        const img = document.createElement('img');
        img.src = `assets/emotes/${e.file_name}`;
        img.title = e.name;
        img.className = 'emote-item';
        img.dataset.emoteId = String(e.id);
        if (forceDisabled) {
            img.classList.add('disabled');
            img.style.cursor = 'not-allowed';
            img.onclick = () => showNotification('You do not own this emote', true);
        } else if (selectedIds.has(e.id)) {
            img.classList.add('disabled');
            img.style.cursor = 'not-allowed';
            img.onclick = () => showNotification('Emote already in deck', true);
        } else {
            img.style.cursor = 'pointer';
            img.onclick = () => onClick(e);
        }
        container.appendChild(img);
    });
}

function renderSlots(container, slots, onSlotChange) {
    container.innerHTML = '';
    for (let i = 0; i < EMOTE_DECK_SIZE; i++) {
        const slot = document.createElement('div');
        slot.className = 'emote-slot';
        slot.dataset.index = i;
        if (slots[i]) {
            const img = document.createElement('img');
            img.src = `assets/emotes/${slots[i].file_name}`;
            img.className = 'emote-item';
            slot.appendChild(img);
            slot.onclick = () => {
                slots[i] = null;
                renderSlots(container, slots, onSlotChange);
                if (typeof onSlotChange === 'function') onSlotChange();
            };
        } else {
            slot.innerText = '+';
            slot.onclick = () => {
                // noop; filling happens via click on emote images
            };
        }
        container.appendChild(slot);
    }
}

async function openEmoteDeckModal() {
    const modal = document.getElementById('emote-deck-modal');
    const allGrid = document.getElementById('emote-all-grid');
    const ownedGrid = document.getElementById('emote-owned-grid');
    const slotsGrid = document.getElementById('emote-deck-slots');

    if (!modal || !allGrid || !ownedGrid || !slotsGrid) return;

    modal.classList.remove('hidden');

    const [allEmotes, ownedEmotes, deckRows] = await Promise.all([loadAllEmotes(), loadOwnedEmotes(), loadUserEmoteDeck()]);

    // show missing emotes (those the player does NOT own)
    const missingEmotes = allEmotes.filter(a => !ownedEmotes.some(o => o.id === a.id));

    // normalize deck to slots with file info
    const slotEmotes = new Array(EMOTE_DECK_SIZE).fill(null);
    for (const row of deckRows) {
        if (row.slot_index >= 0 && row.slot_index < EMOTE_DECK_SIZE) {
            const e = allEmotes.find(a => a.id === row.emote_id);
            if (e) slotEmotes[row.slot_index] = e;
        }
    }

    // helper to compute selected ids
    const selectedIds = () => new Set(slotEmotes.filter(Boolean).map(s => s.id));

    const addEmoteToFirstEmpty = (em) => {
        if (selectedIds().has(em.id)) return showNotification('Emote already in deck', true);
        const idx = slotEmotes.findIndex(s => s === null);
        if (idx === -1) return showNotification('No empty slot available', true);
        slotEmotes[idx] = em;
        renderSlots(slotsGrid, slotEmotes, refreshGrids);
        // re-render grids to update disabled states
        refreshGrids();
    };

    function refreshGrids() {
        // missing emotes: show but disallow adding (not owned)
        renderEmoteGrid(allGrid, missingEmotes, () => showNotification('You do not own this emote', true), selectedIds(), true);
        // owned emotes: allow adding
        renderEmoteGrid(ownedGrid, ownedEmotes, addEmoteToFirstEmpty, selectedIds());
    }

    refreshGrids();

    renderSlots(slotsGrid, slotEmotes, refreshGrids);

    document.getElementById('btn-save-emote-deck').onclick = async () => {
        const payload = slotEmotes.map(s => s ? s.id : null);
        try {
            const res = await fetch('/api/emotes/deck', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots: payload })
            });
            const data = await res.json();
            if (res.ok) {
                showNotification(data.message || 'Saved', 'success');
                modal.classList.add('hidden');
            } else {
                showNotification(data.error || data.message || 'Save failed', true);
            }
        } catch (e) {
            console.error('save emote deck', e); showNotification('Save failed', true);
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('btn-open-emotes');
    const closeBtn = document.getElementById('close-emote-deck');
    const modal = document.getElementById('emote-deck-modal');
    if (openBtn) openBtn.onclick = openEmoteDeckModal;
    if (closeBtn && modal) closeBtn.onclick = () => modal.classList.add('hidden');
});

window.openEmoteDeckModal = openEmoteDeckModal;
