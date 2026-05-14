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

    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    if (avatarPlaceholder && user.avatar) {
        avatarPlaceholder.style.backgroundImage = `url('assets/avatars/${user.avatar}')`;
        avatarPlaceholder.style.backgroundSize = 'cover';
        avatarPlaceholder.style.backgroundPosition = 'center';
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
            loadFriends();
            
            // Trigger external initializers if they exist
            if (typeof window.refreshBalance === 'function') window.refreshBalance();
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
        } else {
            mainMenu.classList.add('hidden');
            if (typeof leaveQueue === 'function') leaveQueue();
            
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
        loadFriends();
        if (typeof fetchCardsFromDB === 'function') fetchCardsFromDB();
        if (typeof fetchMyDeck === 'function') fetchMyDeck();
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
const avatarBox = document.querySelector('.avatar-placeholder');
const avatarModal = document.getElementById('avatar-modal');

if (avatarBox) avatarBox.onclick = () => avatarModal.classList.remove('hidden');
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
        if (dataPending.requests && dataPending.requests.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = `<small style="color: #f1c40f">New requests:</small>`;
            list.appendChild(head);

            dataPending.requests.forEach(req => {
                const li = document.createElement('li');
                li.className = 'friend-item pending';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.padding = '5px 0';
                li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                
                li.innerHTML = `
                    <span>${req.username}</span>
                    <div>
                        <button onclick="handleFriend(${req.friendship_id}, 'accept')" style="background:#27ae60; color:white; border:none; padding:2px 6px; cursor:pointer; margin-right:4px">✓</button>
                        <button onclick="handleFriend(${req.friendship_id}, 'decline')" style="background:#e74c3c; color:white; border:none; padding:2px 7px; cursor:pointer">✕</button>
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
                
                li.innerHTML = `
                    <div class="friend-info">
                        <img src="assets/avatars/${avatarImg}" class="friend-avatar" alt="ava">
                        <span>${f.username}</span>
                    </div>
                    <span style="color: ${statusColor}; font-size: 0.75rem;">${statusLabel}</span>
                `;
                
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
if (btnRemove) {
    btnRemove.onclick = async () => {
        if (!confirm(`Remove ${selectedTargetName} from friends?`)) return;

        try {
            const res = await fetch('/api/friends/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendId: selectedTargetId })
            });
            const result = await res.json();

            showNotification(result.message || result.error, res.ok ? 'success' : 'error');
            if (res.ok) loadFriends();
        } catch (e) {
            showNotification('Removal failed', true);
        }
    };
}

// Expose refreshPlayerStats globally
window.refreshPlayerStats = refreshPlayerStats;