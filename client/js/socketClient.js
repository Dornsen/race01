function initSocket(user) {
    if (!user || socket) return;
    if (typeof io === 'undefined') {
        console.error('Socket.io library is missing!');
        return;
    }

    socketUser = user;
    socket = io({ auth: { userId: user.id, username: user.username } });

    socket.on('queue_status', handleQueueStatus);
    
    socket.on('match_start', handleMatchStart);
    socket.on('match_state', (state) => {
        if (typeof applyServerState === 'function') applyServerState(state);
    });
    socket.on('match_end', handleMatchEnd);

    socket.on('friend_invite', handleIncomingInvite);
    socket.on('friend_invite_cancel', hideInviteModal);
    socket.on('friend_invite_error', (payload) => {
        showNotification(payload.message || 'Invite error', true);
        hideInviteModal();
    });

    socket.on('disconnect', () => {
        if (battleState.isOnline) {
            showNotification('Connection lost', true);
            if (typeof exitBattle === 'function') exitBattle(true);
        }
        hideQueuePanel();
        hideInviteModal();
    });
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    socketUser = null;
}

// --- QUEUE SYSTEM ---
async function joinQueue(mode) {
    if (!socket) {
        showNotification('Please connect first', true);
        return;
    }

    if (typeof fetchMyDeck === 'function' && !hasLoadedDeck) {
        await fetchMyDeck();
    }

    if (myDeck.length !== MAX_DECK_SIZE) {
        showNotification(`You must save a ${MAX_DECK_SIZE}-card deck first.`, true);
        return;
    }

    socket.emit('queue_join', { mode });
}

function leaveQueue() {
    if (socket) socket.emit('queue_leave');
    hideQueuePanel();
}

function handleQueueStatus(payload) {
    if (!payload) return;
    
    if (payload.status === 'queued') {
        queueMode = payload.mode;
        showQueuePanel(queueMode);
        showNotification(`Queued for ${payload.mode}.`);
    } else if (payload.status === 'idle') {
        queueMode = null;
        hideQueuePanel();
    } else if (payload.status === 'error') {
        showNotification(payload.message || 'Queue error', true);
        queueMode = null;
        hideQueuePanel();
    }
}

// --- MATCH EVENTS ---
function handleMatchStart(payload) {
    battleState.isOnline = true;
    battleState.mode = payload.mode || 'casual';
    battleState.inBattle = true;
    hasShownOnlineTurn = false;
    
    hideQueuePanel();
    hideInviteModal();
    
    if (typeof setBattleScreenVisible === 'function') setBattleScreenVisible(true);
    if (typeof syncBattleAvatars === 'function') syncBattleAvatars(payload.opponentAvatar, payload.opponentFrameUrl);
    
    const playerName = document.getElementById('player-name');
    const opponentName = document.getElementById('opponent-name');
    if (playerName) playerName.innerText = socketUser.username || 'Player';
    if (opponentName) opponentName.innerText = payload.opponent || 'Opponent';
    
    if (typeof showCoinFlip === 'function') showCoinFlip('Flipping...');
}

async function handleMatchEnd(payload) {
    if (typeof endBattle === 'function') {
        if (payload.result === 'draw') {
            endBattle('draw');
        } else {
            endBattle(payload.result === 'win' ? 'player' : 'opponent');
        }
    } else {
        if (payload.result === 'draw') {
            showNotification('Draw!');
        } else {
            showNotification(payload.result === 'win' ? 'You win!' : 'You lose', payload.result !== 'win');
        }
        if (battleState.isOnline && typeof exitBattle === 'function') {
            exitBattle(true);
        }
    }

    if (typeof refreshPlayerStats === 'function') await refreshPlayerStats();
}

// --- FRIEND INVITES ---
function sendFriendInvite(friendId, friendName) {
    if (!socket) {
        showNotification('No connection to server', true);
        return;
    }
    socket.emit('friend_invite', { targetUserId: friendId });
    showNotification(`Battle request sent to ${friendName || 'friend'}`);
}

function handleIncomingInvite(payload) {
    if (!payload) return;
    pendingInvite = { fromUserId: payload.fromUserId, fromName: payload.fromName };
    showInviteModal(payload.fromName);
}

function showInviteModal(name) {
    const inviteModal = document.getElementById('friend-invite-modal');
    const inviteText = document.getElementById('invite-text');
    if (!inviteModal || !inviteText) return;
    
    inviteText.innerText = `${name || 'Player'} invites you to battle.`;
    inviteModal.classList.remove('hidden');
}

function hideInviteModal() {
    const inviteModal = document.getElementById('friend-invite-modal');
    if (inviteModal) inviteModal.classList.add('hidden');
    pendingInvite = null;
}


function showQueuePanel(mode) {
    const panel = document.getElementById('queue-panel');
    const modeEl = document.getElementById('queue-mode');
    if (!panel || !modeEl) return;
    
    const label = mode === 'ranked' ? 'Ranked' : (mode === 'casual' ? 'Casual' : '-');
    modeEl.innerText = label;
    panel.classList.remove('hidden');
    
    queueStartAt = Date.now();
    startQueueTimer();
}

function hideQueuePanel() {
    const panel = document.getElementById('queue-panel');
    if (panel) panel.classList.add('hidden');
    stopQueueTimer();
}

function startQueueTimer() {
    stopQueueTimer();
    const timeEl = document.getElementById('queue-time');
    if (!timeEl) return;
    
    if (!queueStartAt) queueStartAt = Date.now();
    queueTimerId = setInterval(() => {
        if (!queueStartAt) queueStartAt = Date.now();
        const elapsed = Math.floor((Date.now() - queueStartAt) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = `${elapsed % 60}`.padStart(2, '0');
        timeEl.innerText = `${mins}:${secs}`;
    }, 500);
}

function stopQueueTimer() {
    if (queueTimerId) {
        clearInterval(queueTimerId);
        queueTimerId = null;
    }
    queueStartAt = null;
    const timeEl = document.getElementById('queue-time');
    if (timeEl) timeEl.innerText = '0:00';
}

// --- UI BUTTON BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    
    const btnRanked = document.querySelector('.mode-btn.ranked');
    if (btnRanked) {
        btnRanked.onclick = () => joinQueue('ranked');
    }

    const btnCasual = document.querySelector('.mode-btn.casual');
    if (btnCasual) {
        btnCasual.onclick = () => joinQueue('casual');
    }

    const btnCancelQueue = document.getElementById('btn-cancel-queue');
    if (btnCancelQueue) btnCancelQueue.onclick = leaveQueue;

    const btnInviteAccept = document.getElementById('btn-invite-accept');
    if (btnInviteAccept) {
        btnInviteAccept.onclick = () => {
            if (pendingInvite && socket) {
                socket.emit('friend_invite_accept', { fromUserId: pendingInvite.fromUserId });
            }
            hideInviteModal();
        };
    }

    const btnInviteDecline = document.getElementById('btn-invite-decline');
    if (btnInviteDecline) {
        btnInviteDecline.onclick = () => {
            if (pendingInvite && socket) {
                socket.emit('friend_invite_decline', { fromUserId: pendingInvite.fromUserId });
            }
            hideInviteModal();
        };
    }
});

window.initSocket = initSocket;
window.disconnectSocket = disconnectSocket;
window.joinQueue = joinQueue;
window.leaveQueue = leaveQueue;
window.sendFriendInvite = sendFriendInvite;