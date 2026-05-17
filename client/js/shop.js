let frameShopCache = [];

function getFramePreviewSize(isShopCard) {
    return isShopCard ? 96 : 64;
}

function renderFrameShop(frames) {
    frameShopCache = Array.isArray(frames) ? frames.slice() : [];

    const shopGrid = document.getElementById('shop-frame-grid');
    const modalGrid = document.getElementById('lobby-frame-grid');

    [shopGrid, modalGrid].forEach((grid) => {
        if (!grid) return;
        grid.innerHTML = '';
    });

    frameShopCache.forEach((frame) => {
        [shopGrid, modalGrid].forEach((grid) => {
            if (!grid) return;

            const isShopCard = grid.id === 'shop-frame-grid';
            const card = document.createElement('div');
            card.className = 'shop-item shop-frame-item';

            // Показываем аватар самого игрока под рамкой, а не заглушку
            const playerAvatar = window.currentUserAvatar
                ? `assets/avatars/${window.currentUserAvatar}`
                : 'assets/avatars/avatar1.png';

            const preview = typeof createAvatarElement === 'function'
                ? createAvatarElement(playerAvatar, frame.image_url, getFramePreviewSize(isShopCard))
                : null;

            if (preview) {
                preview.classList.add('shop-frame-preview');
                card.appendChild(preview);
            }

            const title = document.createElement('div');
            title.className = 'shop-item-title';
            title.textContent = frame.name;
            card.appendChild(title);

            const desc = document.createElement('div');
            desc.className = 'shop-item-desc';
            desc.textContent = frame.equipped
                ? 'Equipped'
                : (frame.owned ? 'Owned' : 'Daily frame');
            card.appendChild(desc);

            const price = document.createElement('div');
            price.className = 'shop-item-price';
            price.textContent = `Price: ⛩️ ${frame.price}`;
            card.appendChild(price);

            const actions = document.createElement('div');
            actions.className = 'shop-frame-actions';

            const button = document.createElement('button');
            button.className = frame.equipped ? 'shop-frame-btn' : 'shop-frame-btn primary';
            button.disabled = Boolean(frame.equipped);
            button.textContent = frame.equipped ? 'Equipped' : (frame.owned ? 'Equip' : 'Buy & Equip');
            button.onclick = () => buyOrEquipFrame(frame.id);
            actions.appendChild(button);

            card.appendChild(actions);
            grid.appendChild(card);
        });
    });
}

async function fetchFrameShop() {
    try {
        const response = await fetch('/api/shop/frames');
        const result = await response.json();

        if (!response.ok) {
            if (typeof showNotification === 'function') {
                showNotification(result.error || 'Failed to load frame shop', true);
            }
            return;
        }

        if (typeof window.setUserMoney === 'function' && result.money !== undefined) {
            window.setUserMoney(result.money);
        }

        renderFrameShop(result.frames || []);

        const equippedFrame = (result.frames || []).find(frame => frame.equipped);
        if (equippedFrame && typeof updatePlayerUI === 'function') {
            updatePlayerUI({ frame_url: equippedFrame.image_url, money: result.money });
        }
    } catch (error) {
        console.error('Frame shop error:', error);
        if (typeof showNotification === 'function') {
            showNotification('Failed to load frame shop', true);
        }
    }
}

async function buyOrEquipFrame(frameId) {
    try {
        const response = await fetch('/api/shop/frames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frameId })
        });
        const result = await response.json();

        if (!response.ok) {
            if (typeof showNotification === 'function') {
                showNotification(result.error || 'Failed to update frame', true);
            }
            return;
        }

        if (typeof showNotification === 'function') {
            showNotification(result.message || 'Frame updated');
        }

        if (result.frame && typeof updatePlayerUI === 'function') {
            updatePlayerUI({ frame_url: result.frame.image_url, money: result.money });
        }

        if (typeof window.setUserMoney === 'function' && result.money !== undefined) {
            window.setUserMoney(result.money);
        }

        await fetchFrameShop();
    } catch (error) {
        console.error('Frame update error:', error);
        if (typeof showNotification === 'function') {
            showNotification('Failed to update frame', true);
        }
    }
}

window.fetchFrameShop = fetchFrameShop;
window.renderFrameShop = renderFrameShop;
window.buyOrEquipFrame = buyOrEquipFrame;