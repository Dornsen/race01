// ==========================================================================
// GLOBALS & STATE
// ==========================================================================
let friendPollInterval = null; 
let selectedTargetId = null;
let selectedTargetName = null;

// ==========================================================================
// 1. PLAYER UI UPDATE
// ==========================================================================
async function refreshPlayerStats() {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        if (result.isLoggedIn && result.user) {
            updatePlayerUI(result.user);
        }
    } catch (e) {
        console.error('Failed to refresh player stats:', e);
    }
}

function updatePlayerUI(user) {
    if (!user) return;

    if (user.avatar) {
        window.currentUserAvatar = user.avatar;
    }

    if (typeof window.applyMusicSettingsFromServer === 'function') {
        window.applyMusicSettingsFromServer(user);
    }

    const greeting = document.getElementById('user-greeting');
    const mmr = document.getElementById('user-mmr');
    
    // IMPORTANT: Update only the fields present in the user object 
    // to prevent "undefined" values from appearing in the UI.
    if (user.username && greeting) {
        greeting.innerText = `Hello, ${user.username}!`;
    }
    
    if (user.mmr !== undefined && mmr) {
        mmr.innerText = user.mmr;
    }

    if (user.money !== undefined) {
        if (typeof window.setUserMoney === 'function') {
            window.setUserMoney(user.money);
        } else {
            const moneyEl = document.getElementById('user-money');
            const shopMoneyEl = document.getElementById('shop-money');
            if (moneyEl) moneyEl.innerText = user.money;
            if (shopMoneyEl) shopMoneyEl.innerText = user.money;
            window.currentMoney = Number(user.money) || 0;
        }
    }

    const avatarImg = document.getElementById('lobby-avatar-img');
    if (avatarImg && user.avatar) {
        avatarImg.src = `assets/avatars/${user.avatar}`;
    }

    const frameImg = document.getElementById('lobby-frame-img');
    if (frameImg && Object.prototype.hasOwnProperty.call(user, 'frame_url')) {
        if (user.frame_url) {
            frameImg.src = user.frame_url;
            frameImg.style.display = 'block';
        } else {
            frameImg.style.display = 'none';
        }
    }
}

// ==========================================================================
// 2. SESSION CHECK ON LOAD
// ==========================================================================
window.onload = async () => {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        
        if (result.isLoggedIn) {
            updatePlayerUI(result.user);
            showBox('main-menu');
            if (typeof window.syncMusicPlayback === 'function') window.syncMusicPlayback();
            loadFriends();
            
            // Trigger external initializers if they exist
            if (typeof window.refreshBalance === 'function') window.refreshBalance();
            if (typeof window.fetchFrameShop === 'function') window.fetchFrameShop();
            if (typeof fetchCardsFromDB === 'function') fetchCardsFromDB();
            if (typeof fetchMyDeck === 'function') fetchMyDeck();
            if (typeof initSocket === 'function') initSocket(result.user);
        }
    } catch (e) { 
        console.log("Anonymous login / No active session."); 
    }
};

// ==========================================================================
// 3. UI NAVIGATION & POLLING
// ==========================================================================
function showBox(boxId) {
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        if (boxId === 'main-menu') {
            mainMenu.classList.remove('hidden');
            
            // Start polling friends every 5 seconds
            if (!friendPollInterval) {
                friendPollInterval = setInterval(loadFriends, 5000);
            }
            if (typeof window.refreshBalance === 'function') window.refreshBalance();
            if (typeof window.syncMusicPlayback === 'function') window.syncMusicPlayback();
        } else {
            mainMenu.classList.add('hidden');
            if (typeof leaveQueue === 'function') leaveQueue();
            const music = document.getElementById('bg-music');
            if (music) music.pause();
            
            // Stop polling to save server resources when not in lobby
            if (friendPollInterval) {
                clearInterval(friendPollInterval);
                friendPollInterval = null;
            }
        }
    }

    // Reset forms and buttons
    document.querySelectorAll('form').forEach(form => {
        form.reset();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            if (btn.hasAttribute('data-default')) btn.innerText = btn.getAttribute('data-default');
        }
    });

    const target = document.getElementById(boxId);
    if (target) target.classList.remove('hidden');
    
    const msgBox = document.getElementById('message');
    if (msgBox) msgBox.innerText = '';
}

// Set up navigation links
document.getElementById('show-register').onclick = () => showBox('register-box');
document.getElementById('show-login').onclick = () => showBox('login-box');
document.getElementById('show-forgot').onclick = () => showBox('forgot-box');
document.querySelectorAll('.back-to-login-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); showBox('login-box'); };
});

// ==========================================================================
// 4. NOTIFICATIONS HANDLER
// ==========================================================================
function showNotification(text, isError = false) {
    const msgBox = document.getElementById('message');
    if (!msgBox) return;

    // Support both boolean and string ('error'/'success') formats
    const isErrorState = isError === true || isError === 'error';

    msgBox.innerText = text;
    msgBox.classList.remove('is-error', 'is-success');
    msgBox.classList.add(isErrorState ? 'is-error' : 'is-success');
    msgBox.classList.add('show');

    if (window.msgTimeout) clearTimeout(window.msgTimeout);

    // Hide notification after 3 seconds
    window.msgTimeout = setTimeout(() => {
        msgBox.classList.remove('show');
        // Clear text only after CSS fade-out animation completes
        setTimeout(() => { msgBox.innerText = ''; }, 400);
    }, 3000);
}

// ==========================================================================
// 5. UNIVERSAL API WRAPPER
// ==========================================================================
async function apiCall(endpoint, data, formId) {
    const form = document.getElementById(formId);
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    
    const originalBtnText = btn ? (btn.getAttribute('data-default') || btn.innerText) : '';
    if (btn && !btn.hasAttribute('data-default')) btn.setAttribute('data-default', originalBtnText);

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Loading...';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message || 'Success');
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
            return { success: true, data: result };
        } else {
            showNotification(result.error || 'Error', true);
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
            return { success: false };
        }
    } catch (err) {
        showNotification('Connection error', true);
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalBtnText;
        }
        return { success: false };
    }
}

// ==========================================================================
// 6. FORM SUBMISSIONS
// ==========================================================================

// Register
document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const res = await apiCall('/api/register', {
        username: document.getElementById('reg-username').value,
        email: email,
        password: document.getElementById('reg-password').value,
        avatar_url: document.getElementById('reg-avatar-url').value 
    }, 'register-form'); 
    
    if (res.success) {
        document.getElementById('verify-email').value = email;
        setTimeout(() => showBox('verify-box'), 1500);
    }
};

// Login
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/login', {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
    }, 'login-form');
    
    if (res.success) {
        updatePlayerUI(res.data.user);
        showBox('main-menu');
        if (typeof window.syncMusicPlayback === 'function') window.syncMusicPlayback();
        loadFriends();
        if (typeof fetchCardsFromDB === 'function') fetchCardsFromDB();
        if (typeof fetchMyDeck === 'function') fetchMyDeck();
        if (typeof window.fetchFrameShop === 'function') window.fetchFrameShop();
        if (typeof initSocket === 'function') initSocket(res.data.user);
    }
};

// Forgot Password
document.getElementById('forgot-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const res = await apiCall('/api/forgot-password', { email }, 'forgot-form');
    if (res.success) {
        document.getElementById('reset-email-hidden').value = email;
        setTimeout(() => showBox('reset-box'), 1500);
    }
};

// Reset Password
document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/reset-password', {
        email: document.getElementById('reset-email-hidden').value,
        token: document.getElementById('reset-token').value,
        newPassword: document.getElementById('reset-new-password').value
    }, 'reset-form');
    if (res.success) setTimeout(() => showBox('login-box'), 1500);
};

// Verify Email
document.getElementById('verify-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/verify', {
        email: document.getElementById('verify-email').value,
        code: document.getElementById('verify-code').value
    }, 'verify-form');
    if (res.success) setTimeout(() => showBox('login-box'), 1500);
};

// ==========================================================================
// 7. LOBBY & MODALS
// ==========================================================================
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            showBox('login-box');
            showNotification('Logged out successfully.');
            if (typeof disconnectSocket === 'function') disconnectSocket();
        } catch (err) {
            console.error("Logout error:", err);
        }
    };
}

// Avatar Modal Handlers
const avatarBox = document.getElementById('lobby-avatar-btn');
const avatarModal = document.getElementById('avatar-modal');

if (avatarBox) avatarBox.onclick = async () => {
    if (typeof fetchFrameShop === 'function') await fetchFrameShop();
    avatarModal.classList.remove('hidden');
};
if (document.getElementById('close-modal')) document.getElementById('close-modal').onclick = () => avatarModal.classList.add('hidden');

// Avatar Grid Selection
document.querySelectorAll('.avatar-grid').forEach(grid => {
    grid.onclick = async (e) => {
        if (e.target.classList.contains('avatar-item')) {
            grid.querySelectorAll('.avatar-item').forEach(img => img.classList.remove('selected'));
            e.target.classList.add('selected');
            const selectedAvatar = e.target.getAttribute('data-avatar');

            if (grid.id === 'reg-avatar-grid') {
                // Save to hidden input for registration
                document.getElementById('reg-avatar-url').value = selectedAvatar;
            } else {
                // Live update in Lobby
                const res = await apiCall('/api/update-avatar', { avatar_url: selectedAvatar }, null);
                if (res.success) {
                    updatePlayerUI({ avatar: selectedAvatar });
                    avatarModal.classList.add('hidden');
                }
            }
        }
    };
});

// Main Play Button Toggle
const playBtnMain = document.getElementById('btn-play-main');
const playModes = document.getElementById('play-modes');
if (playBtnMain && playModes) {
    playBtnMain.onclick = () => playModes.classList.toggle('hidden');
}

// ==========================================================================
// 8. FRIENDLIST LOGIC
// ==========================================================================
async function loadFriends() {
    try {
        const [resF, resP] = await Promise.all([
            fetch('/api/friends'),
            fetch('/api/friends/pending')
        ]);
        
        const dataFriends = await resF.json();
        const dataPending = await resP.json();
        const list = document.getElementById('friend-list');
        list.innerHTML = '';

        // Render Pending Requests
       // Render Pending Requests (Beautiful compact cards inside sidebar)
        if (dataPending.requests && dataPending.requests.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = `<small style="color: #633D3D; font-family: 'Marcellus', serif; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 8px; padding-left: 5px;">New Requests</small>`;
            list.appendChild(head);

            dataPending.requests.forEach(req => {
                const li = document.createElement('li');
                li.className = 'friend-request-item'; // Наш новый класс для красивой стилизации
                
                // Используем заготовленные аватарки, если они приходят с сервера, либо дефолтную
                const avatarImg = req.avatar_url ? req.avatar_url : 'avatar1.png';

                li.innerHTML = `
                    <div class="friend-request-header">
                        <div class="friend-request-info">
                            <div class="friend-avatar-wrap">
                                <img class="base-avatar" src="assets/avatars/${avatarImg}" alt="avatar" style="border-radius: 50%; width: 28px; height: 28px; object-fit: cover; border: 1px solid rgba(139, 126, 109, 0.3);">
                            </div>
                            <span class="friend-name" style="color: #D0CBB5; font-weight: 500; font-size: 0.9rem;">${req.username}</span>
                        </div>
                        <span class="friend-request-tag">Request</span>
                    </div>
                    <div class="friend-request-actions">
                        <button class="btn-accept" onclick="handleFriend(${req.friendship_id}, 'accept')">Accept</button>
                        <button class="btn-decline" onclick="handleFriend(${req.friendship_id}, 'decline')">Decline</button>
                    </div>
                `;
                list.appendChild(li);
            });
        }

        // Render Accepted Friends
        if (dataFriends.friends && dataFriends.friends.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = `<small style="opacity:0.6; padding-left: 5px;">Friends (${dataFriends.friends.length}/50):</small>`;
            list.appendChild(head);

            dataFriends.friends.forEach(f => {
                const li = document.createElement('li');
                li.className = 'friend-item';
                
                const avatarImg = f.avatar_url ? f.avatar_url : 'avatar1.png'; 
                const statusLabel = (() => {
                    if (f.status === 'online') return 'online';
                    if (f.status === 'searching for battle') return 'searching';
                    if (f.status === 'in battle') return 'in battle';
                    if (f.status === 'away') return 'away';
                    return 'offline';
                })();
                
                const statusColor = f.status === 'online'
                    ? '#2ecc71'
                    : (f.status === 'searching for battle' ? '#f1c40f' : (f.status === 'in battle' ? '#e67e22' : '#7f8c8d'));
                
                const friendInfo = document.createElement('div');
                friendInfo.className = 'friend-info';

                if (typeof createAvatarElement === 'function') {
                    const avatarWrap = createAvatarElement(`assets/avatars/${avatarImg}`, f.frame_url || null, 30);
                    avatarWrap.classList.add('friend-avatar-wrap');
                    friendInfo.appendChild(avatarWrap);
                } else {
                    const avatar = document.createElement('img');
                    avatar.src = `assets/avatars/${avatarImg}`;
                    avatar.className = 'friend-avatar';
                    avatar.alt = 'ava';
                    friendInfo.appendChild(avatar);
                }

                const name = document.createElement('span');
                name.textContent = f.username;
                friendInfo.appendChild(name);

                const status = document.createElement('span');
                status.style.color = statusColor;
                status.style.fontSize = '0.75rem';
                status.textContent = statusLabel;

                li.appendChild(friendInfo);
                li.appendChild(status);
                
                // Right-click context menu handler
                li.oncontextmenu = (e) => {
                    e.preventDefault(); 
                    showFriendMenu(e.pageX, e.pageY, f.id, f.username);
                };
                
                list.appendChild(li);
            });
        } else if (!dataPending.requests || dataPending.requests.length === 0) {
            list.innerHTML = '<li class="empty-friends">No friends yet</li>';
        }

    } catch (e) { 
        console.error("Friendlist error:", e); 
    }
}

// Universal handler for Accept/Decline buttons
window.handleFriend = async (id, action) => {
    const res = await fetch('/api/friends/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: id, action: action })
    });
    const result = await res.json();
    showNotification(result.message || result.error, res.ok ? 'success' : 'error');
    if (res.ok) loadFriends(); 
};

// Add Friend Button (+)
const btnAddFriend = document.getElementById('btn-add-friend');
if (btnAddFriend) {
    btnAddFriend.onclick = async () => {
        const input = document.getElementById('add-friend-input');
        const username = input.value.trim();
        if (!username) return;

        try {
            const res = await fetch('/api/friends/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendUsername: username })
            });
            const result = await res.json();
            
            showNotification(result.message || result.error, res.ok ? 'success' : 'error');
            
            if (res.ok) {
                input.value = ''; 
                loadFriends();    
            }
        } catch (e) {
            showNotification('Connection error', 'error');
        }
    };
}

// ==========================================================================
// 9. CONTEXT MENU
// ==========================================================================
const ctxMenu = document.getElementById('friend-context-menu');

function showFriendMenu(x, y, friendId, friendName) {
    selectedTargetId = friendId;
    selectedTargetName = friendName;
    
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');
}

// Hide menu on outside click
document.addEventListener('click', () => {
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
        ctxMenu.classList.add('hidden');
    }
});

// "Invite to Battle" button
const btnInvite = document.getElementById('ctx-invite');
if (btnInvite) {
    btnInvite.onclick = () => {
        if (typeof sendFriendInvite === 'function') {
            sendFriendInvite(selectedTargetId, selectedTargetName);
        } else {
            showNotification(`Battle request sent to ${selectedTargetName}!`);
        }
    };
}

// "Remove Friend" button
const btnRemove = document.getElementById('ctx-remove');
const deleteModal = document.getElementById('friend-delete-modal');
const deleteFriendNameSpan = document.getElementById('delete-friend-name');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');

if (btnRemove) {
    btnRemove.onclick = () => {
        // Скрываем контекстное меню, чтобы оно не висело на экране
        const ctxMenu = document.getElementById('friend-context-menu');
        if (ctxMenu) ctxMenu.classList.add('hidden');

        // Открываем кастомную модалку и подставляем имя друга
        if (deleteModal && deleteFriendNameSpan) {
            deleteFriendNameSpan.textContent = selectedTargetName || "этого игрока";
            deleteModal.classList.remove('hidden');
        }
    };
}

// Клик по кнопке "Удалить" в кастомной модалке
if (btnDeleteConfirm) {
    btnDeleteConfirm.onclick = async () => {
        // Сразу прячем модалку
        if (deleteModal) deleteModal.classList.add('hidden');

        if (!selectedTargetId) return;

        try {
            const res = await fetch('/api/friends/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendId: selectedTargetId })
            });
            const result = await res.json();

            // Показываем красивую игровую нотификацию (is-success / is-error)
            const isSuccess = res.ok;
            showNotification(result.message || result.error, isSuccess ? 'success' : 'error');
            
            // Перезагружаем список друзей, если удаление прошло успешно
            if (res.ok && typeof loadFriends === 'function') {
                loadFriends();
            }
        } catch (e) {
            console.error("Error removing friend:", e);
        }
    };
}

// Клик по кнопке "Отмена" в кастомной модалке
if (btnDeleteCancel) {
    btnDeleteCancel.onclick = () => {
        if (deleteModal) deleteModal.classList.add('hidden');
    };
}

// Expose refreshPlayerStats globally
window.refreshPlayerStats = refreshPlayerStats;