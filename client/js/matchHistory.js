/* =========================================
   HISTORY.JS - MATCH HISTORY & LEADERBOARD
   ========================================= */

// --- 1. MATCH HISTORY ---

async function fetchMatchHistory() {
    try {
        const res = await fetch('/api/matches/history');
        const data = await res.json();
        
        if (!res.ok) {
            if (typeof showNotification === 'function') {
                showNotification(data.error || 'History error', true);
            }
            return;
        }
        
        // Update globals (from globals.js)
        historyCache = data.matches || [];
        historyDelta = data.mmrDelta || { win: 0, lose: 0 };
        
        applyHistoryFilters();
    } catch (e) {
        if (typeof showNotification === 'function') {
            showNotification('Failed to load match history', true);
        }
    }
}

function renderMatchHistory(matches) {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';

    if (!matches.length) {
        list.innerHTML = '<div class="history-empty">No matches found</div>';
        return;
    }

    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const avatar = match.opponent_avatar ? `assets/avatars/${match.opponent_avatar}` : 'assets/avatars/avatar1.png';
        const createdAt = new Date(match.created_at).toLocaleString(); 
        const resultClass = match.result || 'draw';
        
        // Translate result
        let resultLabel = 'Draw';
        if (match.result === 'win') resultLabel = 'Victory';
        else if (match.result === 'lose') resultLabel = 'Defeat';

        // Translate mode
        let modeLabel = 'Friendly';
        if (match.mode === 'ranked') modeLabel = 'Ranked';
        else if (match.mode === 'casual') modeLabel = 'Casual';

        item.innerHTML = `
            <div class="history-left">
                <div class="history-avatar" style="background-image: url('${avatar}')"></div>
                <div>
                    <div class="history-name">${match.opponent_name || 'Opponent'}</div>
                    <div class="history-meta">${modeLabel} • ${createdAt}</div>
                </div>
            </div>
            <div class="history-result ${resultClass}">${resultLabel}</div>
        `;
        
        item.onclick = () => showHistoryDetail(match);
        list.appendChild(item);
    });
}

function applyHistoryFilters() {
    const modeEl = document.getElementById('history-filter-mode');
    const searchEl = document.getElementById('history-search');
    const sortEl = document.getElementById('history-sort');
    
    if (!modeEl || !searchEl || !sortEl) return;

    const mode = modeEl.value;
    const query = searchEl.value.trim().toLowerCase();
    const sort = sortEl.value;

    if (typeof historyCache === 'undefined') return;

    let filtered = historyCache.slice();
    
    if (mode !== 'all') {
        filtered = filtered.filter(item => item.mode === mode);
    }
    
    if (query) {
        filtered = filtered.filter(item => (item.opponent_name || '').toLowerCase().includes(query));
    }

    if (sort === 'date_asc') {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'name_asc') {
        filtered.sort((a, b) => (a.opponent_name || '').localeCompare(b.opponent_name || ''));
    } else if (sort === 'name_desc') {
        filtered.sort((a, b) => (b.opponent_name || '').localeCompare(a.opponent_name || ''));
    } else {
        // Default is date_desc
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderMatchHistory(filtered);
}

function showHistoryDetail(match) {
    const modal = document.getElementById('history-detail');
    const body = document.getElementById('history-detail-body');
    if (!modal || !body) return;

    const createdAt = new Date(match.created_at).toLocaleString();
    
    let resultLabel = 'Draw';
    if (match.result === 'win') resultLabel = 'Victory';
    else if (match.result === 'lose') resultLabel = 'Defeat';

    let modeLabel = 'Friendly';
    if (match.mode === 'ranked') modeLabel = 'Ranked';
    else if (match.mode === 'casual') modeLabel = 'Casual';

    const reason = match.reason || '—';
    
    // Calculate MMR Delta
    const deltaValue = match.mode === 'ranked'
        ? (match.result === 'win' ? historyDelta.win : (match.result === 'lose' ? historyDelta.lose : 0))
        : 0;
    const delta = deltaValue > 0 ? `+${deltaValue}` : `${deltaValue}`;

    body.innerHTML = `
        <div><strong>Opponent:</strong> ${match.opponent_name || 'Opponent'}</div>
        <div><strong>Mode:</strong> ${modeLabel}</div>
        <div><strong>Result:</strong> ${resultLabel}</div>
        <div><strong>Date:</strong> ${createdAt}</div>
        <div><strong>Reason:</strong> ${reason}</div>
        <div><strong>Rating Change:</strong> ${delta}</div>
    `;
    modal.classList.remove('hidden');
}

// --- 2. LEADERBOARD ---

async function fetchLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        
        if (!res.ok) {
            if (typeof showNotification === 'function') {
                showNotification(data.error || 'Leaderboard error', true);
            }
            return;
        }
        renderLeaderboard(data.leaderboard || []);
    } catch (e) {
        if (typeof showNotification === 'function') {
            showNotification('Failed to load leaderboard', true);
        }
    }
}

function renderLeaderboard(items) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items.length) {
        list.innerHTML = '<div class="history-empty">No data available</div>';
        return;
    }

    items.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div><span class="leaderboard-rank">#${index + 1}</span> ${row.username}</div>
            <div>${row.match_making_rating} MMR</div>
        `;
        list.appendChild(item);
    });
}

// --- 3. EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    // Modal background click
    const historyDetail = document.getElementById('history-detail');
    if (historyDetail) {
        historyDetail.onclick = (e) => {
            if (e.target === historyDetail) historyDetail.classList.add('hidden');
        };
    }

    // Modal close button
    const historyDetailClose = document.getElementById('history-detail-close');
    if (historyDetailClose) {
        historyDetailClose.onclick = () => {
            if (historyDetail) historyDetail.classList.add('hidden');
        };
    }

    // Filter bindings
    const historyFilterMode = document.getElementById('history-filter-mode');
    if (historyFilterMode) historyFilterMode.onchange = applyHistoryFilters;
    
    const historySearch = document.getElementById('history-search');
    if (historySearch) historySearch.oninput = applyHistoryFilters;
    
    const historySort = document.getElementById('history-sort');
    if (historySort) historySort.onchange = applyHistoryFilters;
});

// Expose to window for navigation.js to call
window.fetchMatchHistory = fetchMatchHistory;
window.fetchLeaderboard = fetchLeaderboard;