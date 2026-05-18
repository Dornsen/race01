const lobbyNewsTrack = document.getElementById('lobby-news-track');
const lobbyNewsDots = document.getElementById('lobby-news-dots');
const lobbyNewsPrev = document.getElementById('lobby-news-prev');
const lobbyNewsNext = document.getElementById('lobby-news-next');
const lobbyNewsCounter = document.getElementById('lobby-news-counter');
const lobbyNewsRoot = document.getElementById('lobby-news');

const fallbackLobbyNewsItems = [
    {
        id: 0,
        chip: 'Update',
        title: 'Season of Ash is Live',
        text: 'New balance pass, faster queue timings and improved battle emote sync are now active in all modes.',
        actionText: 'Open Quests',
        actionType: 'screen',
        actionTarget: 'quests',
        background: 'linear-gradient(135deg, rgba(106, 23, 17, 0.75), rgba(16, 18, 25, 0.9)), radial-gradient(circle at 15% 20%, rgba(240, 164, 84, 0.35), transparent 40%)'
    },
    {
        id: 0,
        chip: 'Shop',
        title: 'Omamori Event Banner',
        text: 'Ritual x5 is still discounted. Visit Omamori and claim your guaranteed epic+ card in the final pack.',
        actionText: 'Go to Omamori',
        actionType: 'screen',
        actionTarget: 'gacha',
        background: 'linear-gradient(135deg, rgba(26, 43, 68, 0.72), rgba(13, 16, 20, 0.92)), radial-gradient(circle at 80% 10%, rgba(89, 159, 255, 0.32), transparent 40%)'
    },
    {
        id: 0,
        chip: 'Social',
        title: 'Challenge Friends Instantly',
        text: 'Right-click a friend to send a duel invite and jump straight into a live PvP match.',
        actionText: 'View Leaderboard',
        actionType: 'screen',
        actionTarget: 'leaderboard',
        background: 'linear-gradient(135deg, rgba(35, 53, 28, 0.75), rgba(12, 15, 18, 0.9)), radial-gradient(circle at 20% 15%, rgba(171, 209, 112, 0.3), transparent 40%)'
    }
];

const lobbyNewsState = {
    index: 0,
    timerId: null,
    intervalMs: 5500,
    items: [],
    seenImpressions: new Set()
};

function formatNewsCounter(index, total) {
    const left = `${index + 1}`.padStart(2, '0');
    const right = `${total}`.padStart(2, '0');
    return `${left} / ${right}`;
}

function goToScreenFromNews(targetId) {
    const mainMenu = document.getElementById('main-menu');
    if (!mainMenu) return;

    const targetButtonMap = {
        quests: 'btn-quests',
        leaderboard: 'btn-leaderboard',
        shop: 'btn-shop',
        gacha: 'btn-gacha'
    };

    const buttonId = targetButtonMap[targetId];
    const targetButton = buttonId ? document.getElementById(buttonId) : null;

    if (targetButton) {
        targetButton.click();
        return;
    }

    if (typeof switchScreen === 'function') {
        switchScreen('main-menu', targetId);
    }
}

async function trackNewsMetric(id, type) {
    if (!id) return;
    const endpoint = type === 'click' ? `/api/news/${id}/click` : `/api/news/${id}/impression`;
    try {
        await fetch(endpoint, { method: 'POST' });
    } catch (_error) {
        // Silent metrics failure should never break lobby UX.
    }
}

function stopLobbyNewsAutoplay() {
    if (lobbyNewsState.timerId) {
        clearInterval(lobbyNewsState.timerId);
        lobbyNewsState.timerId = null;
    }
}

function startLobbyNewsAutoplay() {
    stopLobbyNewsAutoplay();
    lobbyNewsState.timerId = setInterval(() => {
        setLobbyNewsSlide(lobbyNewsState.index + 1);
    }, lobbyNewsState.intervalMs);
}

function setLobbyNewsSlide(nextIndex) {
    if (!lobbyNewsTrack || lobbyNewsState.items.length === 0) return;

    const normalized = (nextIndex + lobbyNewsState.items.length) % lobbyNewsState.items.length;
    lobbyNewsState.index = normalized;

    lobbyNewsTrack.style.transform = `translateX(-${normalized * 100}%)`;

    const dots = lobbyNewsDots ? Array.from(lobbyNewsDots.querySelectorAll('.lobby-news-dot')) : [];
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === normalized);
    });

    if (lobbyNewsCounter) {
        lobbyNewsCounter.innerText = formatNewsCounter(normalized, lobbyNewsState.items.length);
    }

    const activeItem = lobbyNewsState.items[normalized];
    if (activeItem && activeItem.id && !lobbyNewsState.seenImpressions.has(activeItem.id)) {
        lobbyNewsState.seenImpressions.add(activeItem.id);
        trackNewsMetric(activeItem.id, 'impression');
    }
}

function createLobbyNewsSlide(item) {
    const slide = document.createElement('article');
    slide.className = 'lobby-news-slide';

    if (item.background_type === 'image') {
        const bgValue = String(item.background || '').trim();
        const safeImage = bgValue.startsWith('url(') ? bgValue : `url('${bgValue}')`;
        slide.style.background = `linear-gradient(180deg, rgba(10, 11, 16, 0.35), rgba(10, 11, 16, 0.72)), ${safeImage}`;
    } else {
        slide.style.background = item.background;
    }

    const chip = document.createElement('span');
    chip.className = 'lobby-news-chip';
    chip.innerText = item.chip;
    slide.appendChild(chip);

    const title = document.createElement('h3');
    title.className = 'lobby-news-headline';
    title.innerText = item.title;
    slide.appendChild(title);

    const copy = document.createElement('p');
    copy.className = 'lobby-news-copy';
    copy.innerText = item.text;
    slide.appendChild(copy);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'lobby-news-action';
    action.innerText = item.actionText || 'Open';
    action.style.display = item.actionText ? 'inline-flex' : 'none';
    action.onclick = () => {
        if (item.id) trackNewsMetric(item.id, 'click');
        if (item.actionType === 'screen' && item.actionTarget) {
            goToScreenFromNews(item.actionTarget);
        }
    };
    slide.appendChild(action);

    return slide;
}

function normalizeServerNews(rows) {
    return (rows || []).map((row) => ({
        id: row.id,
        chip: row.chip || 'Update',
        title: row.title || 'News',
        text: row.body || '',
        actionText: row.cta_text || '',
        actionType: row.cta_target ? 'screen' : '',
        actionTarget: row.cta_target || '',
        background_type: row.background_type || 'gradient',
        background: row.background_value || 'linear-gradient(135deg, rgba(106, 23, 17, 0.75), rgba(16, 18, 25, 0.9))'
    }));
}

async function fetchLobbyNewsItems() {
    try {
        const response = await fetch('/api/news/lobby');
        if (!response.ok) return fallbackLobbyNewsItems;

        const payload = await response.json();
        const normalized = normalizeServerNews(payload.news || []);
        return normalized.length ? normalized : fallbackLobbyNewsItems;
    } catch (_error) {
        return fallbackLobbyNewsItems;
    }
}

async function initLobbyNews() {
    if (!lobbyNewsTrack || !lobbyNewsDots || !lobbyNewsRoot) return;

    lobbyNewsState.items = await fetchLobbyNewsItems();
    if (lobbyNewsState.items.length === 0) return;

    lobbyNewsTrack.innerHTML = '';
    lobbyNewsDots.innerHTML = '';
    lobbyNewsState.seenImpressions.clear();

    lobbyNewsState.items.forEach((item, idx) => {
        const slide = createLobbyNewsSlide(item);
        lobbyNewsTrack.appendChild(slide);

        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'lobby-news-dot';
        dot.ariaLabel = `Go to news slide ${idx + 1}`;
        dot.onclick = () => {
            setLobbyNewsSlide(idx);
            startLobbyNewsAutoplay();
        };
        lobbyNewsDots.appendChild(dot);
    });

    if (lobbyNewsPrev) {
        lobbyNewsPrev.onclick = () => {
            setLobbyNewsSlide(lobbyNewsState.index - 1);
            startLobbyNewsAutoplay();
        };
    }

    if (lobbyNewsNext) {
        lobbyNewsNext.onclick = () => {
            setLobbyNewsSlide(lobbyNewsState.index + 1);
            startLobbyNewsAutoplay();
        };
    }

    lobbyNewsRoot.addEventListener('mouseenter', stopLobbyNewsAutoplay);
    lobbyNewsRoot.addEventListener('mouseleave', startLobbyNewsAutoplay);

    setLobbyNewsSlide(0);
    startLobbyNewsAutoplay();
}

initLobbyNews();
