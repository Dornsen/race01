const db = require('../config/database');
const GAME_CONFIG = require('../config/gameConfig');

const queues = {
    ranked: [],
    casual: []
};

const matches = new Map();
const playerMatch = new Map();
const onlineUsers = new Map();

function setUserStatus(userId, status) {
    if (!userId) return;
    db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
}

function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function loadDeckForUser(userId) {
    const [rows] = await db.query(
        `
        SELECT c.*
        FROM active_decks ad
        JOIN cards c ON ad.card_id = c.id
        WHERE ad.user_id = ?
        ORDER BY ad.id ASC
        `,
        [userId]
    );
    return rows;
}

function makeBattleCard(owner, card) {
    return {
        id: card.id,
        name: card.name,
        cost: card.cost,
        attack: card.attack,
        defense: card.defense,
        rarity: card.rarity,
        image: card.avatar_url,
        description: card.description,
        ability: card.ability_description,
        clan: card.clan,
        currentHp: card.defense,
        summoningSick: false,
        hasAttacked: false,
        uid: owner.nextUid++
    };
}

function drawUpToLimit(player) {
    while (player.hand.length < GAME_CONFIG.handLimit && player.deck.length > 0) {
        player.hand.push(player.deck.shift());
    }
}

function buildPublicCard(card) {
    return {
        id: card.id,
        uid: card.uid,
        name: card.name,
        cost: card.cost,
        attack: card.attack,
        defense: card.defense,
        rarity: card.rarity,
        image: card.image,
        currentHp: card.currentHp,
        summoningSick: card.summoningSick,
        hasAttacked: card.hasAttacked
    };
}

function buildStateForPlayer(match, socketId) {
    const you = match.players.find(p => p.socketId === socketId);
    const opponent = match.players.find(p => p.socketId !== socketId);

    return {
        matchId: match.id,
        mode: match.mode,
        config: GAME_CONFIG,
        turn: match.turnSocketId === socketId ? 'you' : 'opponent',
        turnEndsAt: match.turnEndsAt,
        you: {
            userId: you.userId,
            name: you.username,
            hp: you.hp,
            energy: you.energy,
            deckCount: you.deck.length,
            hand: you.hand.map(buildPublicCard),
            board: you.board.map(buildPublicCard)
        },
        opponent: {
            userId: opponent.userId,
            name: opponent.username,
            hp: opponent.hp,
            energy: opponent.energy,
            deckCount: opponent.deck.length,
            handCount: opponent.hand.length,
            board: opponent.board.map(buildPublicCard)
        }
    };
}

function emitState(match, io) {
    match.players.forEach(player => {
        const state = buildStateForPlayer(match, player.socketId);
        io.to(player.socketId).emit('match_state', state);
    });
}

function clearTurnTimer(match) {
    if (match.turnTimerId) {
        clearTimeout(match.turnTimerId);
        match.turnTimerId = null;
    }
}

function scheduleTurnTimer(match, io) {
    clearTurnTimer(match);
    match.turnEndsAt = Date.now() + GAME_CONFIG.turnTimeSec * 1000;
    match.turnTimerId = setTimeout(() => {
        endTurn(match, io);
    }, GAME_CONFIG.turnTimeSec * 1000);
}

function startTurn(match, player, io) {
    player.energy = Math.min(GAME_CONFIG.energyMax, player.energy + GAME_CONFIG.energyPerRound);
    player.board.forEach(card => {
        card.hasAttacked = false;
        card.summoningSick = false;
    });
    drawUpToLimit(player);
    match.turnSocketId = player.socketId;
    scheduleTurnTimer(match, io);
    emitState(match, io);
}

function endTurn(match, io) {
    if (!match || !match.players.length) return;
    const nextPlayer = match.players.find(p => p.socketId !== match.turnSocketId) || match.players[0];
    startTurn(match, nextPlayer, io);
}

async function endMatch(match, io, result) {
    clearTurnTimer(match);
    const isDraw = !result.winnerSocketId;
    match.players.forEach(player => {
        const outcome = isDraw ? 'draw' : (player.socketId === result.winnerSocketId ? 'win' : 'lose');
        io.to(player.socketId).emit('match_end', {
            result: outcome,
            reason: result.reason || 'finished'
        });
        playerMatch.delete(player.socketId);
        setUserStatus(player.userId, 'online');
    });

    if (!isDraw && match.mode === 'ranked' && result.winnerUserId && result.loserUserId) {
        const winDelta = GAME_CONFIG.rankedWinDelta;
        const loseDelta = GAME_CONFIG.rankedLoseDelta;
        try {
            await Promise.all([
                db.query(
                    'UPDATE users SET match_making_rating = GREATEST(0, match_making_rating + ?) WHERE id = ?',
                    [winDelta, result.winnerUserId]
                ),
                db.query(
                    'UPDATE users SET match_making_rating = GREATEST(0, match_making_rating + ?) WHERE id = ?',
                    [loseDelta, result.loserUserId]
                )
            ]);
        } catch (error) {
            console.error('MMR update failed', error);
        }
    }

    const playerA = match.players[0];
    const playerB = match.players[1];
    if (playerA && playerB) {
        const winnerId = result.winnerUserId || null;
        db.query(
            'INSERT INTO match_history (mode, player1_id, player2_id, winner_id, reason) VALUES (?, ?, ?, ?, ?)',
            [match.mode, playerA.userId, playerB.userId, winnerId, result.reason || null]
        );
    }

    matches.delete(match.id);
}

function checkWin(match, io) {
    const [p1, p2] = match.players;
    if (p1.hp <= 0 && p2.hp <= 0) {
        void endMatch(match, io, { reason: 'draw' });
        return true;
    }
    if (p1.hp <= 0) {
        void endMatch(match, io, {
            reason: 'hp',
            winnerSocketId: p2.socketId,
            loserSocketId: p1.socketId,
            winnerUserId: p2.userId,
            loserUserId: p1.userId
        });
        return true;
    }
    if (p2.hp <= 0) {
        void endMatch(match, io, {
            reason: 'hp',
            winnerSocketId: p1.socketId,
            loserSocketId: p2.socketId,
            winnerUserId: p1.userId,
            loserUserId: p2.userId
        });
        return true;
    }
    return false;
}

function removeFromQueue(socketId) {
    Object.keys(queues).forEach(mode => {
        queues[mode] = queues[mode].filter(entry => entry.socketId !== socketId);
    });
}

function getSocketIdByUserId(userId) {
    return onlineUsers.get(Number(userId));
}

function createMatch(io, mode, playerA, playerB) {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const match = {
        id: matchId,
        mode,
        players: [playerA, playerB],
        turnSocketId: null,
        turnEndsAt: null,
        turnTimerId: null,
        nextUid: 1
    };
    matches.set(matchId, match);
    playerMatch.set(playerA.socketId, matchId);
    playerMatch.set(playerB.socketId, matchId);

    drawUpToLimit(playerA);
    drawUpToLimit(playerB);

    setUserStatus(playerA.userId, 'in battle');
    setUserStatus(playerB.userId, 'in battle');

    io.to(playerA.socketId).emit('match_start', { mode, opponent: playerB.username });
    io.to(playerB.socketId).emit('match_start', { mode, opponent: playerA.username });

    setTimeout(() => {
        const starter = Math.random() > 0.5 ? playerA : playerB;
        startTurn(match, starter, io);
    }, 1200);
}

async function handleQueueJoin(io, socket, payload) {
    const mode = payload && payload.mode === 'ranked' ? 'ranked' : 'casual';
    removeFromQueue(socket.id);

    if (playerMatch.has(socket.id)) {
        socket.emit('queue_status', { status: 'error', message: 'Already in match.' });
        return;
    }

    let deck = [];
    try {
        deck = await loadDeckForUser(socket.data.userId);
    } catch (error) {
        socket.emit('queue_status', { status: 'error', message: 'Deck load failed.' });
        return;
    }

    if (deck.length !== GAME_CONFIG.deckSize) {
        socket.emit('queue_status', { status: 'error', message: `Need ${GAME_CONFIG.deckSize} cards in your deck.` });
        return;
    }

    setUserStatus(socket.data.userId, 'searching for battle');

    const player = {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
        hp: GAME_CONFIG.health,
        energy: 0,
        hand: [],
        board: [],
        nextUid: 1,
        deck: []
    };
    player.deck = shuffle(deck).map(card => makeBattleCard(player, card));

    const queue = queues[mode];
    if (queue.length > 0) {
        const opponentEntry = queue.shift();
        createMatch(io, mode, player, opponentEntry.player);
    } else {
        queue.push({ socketId: socket.id, player });
        socket.emit('queue_status', { status: 'queued', mode });
    }
}

async function handleFriendInvite(io, socket, payload) {
    const targetUserId = payload && payload.targetUserId;
    if (!targetUserId) return;
    const targetSocketId = getSocketIdByUserId(targetUserId);
    if (!targetSocketId) {
        socket.emit('friend_invite_error', { message: 'Игрок не в сети' });
        return;
    }

    io.to(targetSocketId).emit('friend_invite', {
        fromUserId: socket.data.userId,
        fromName: socket.data.username
    });
}

async function handleFriendInviteAccept(io, socket, payload) {
    const fromUserId = payload && payload.fromUserId;
    const fromSocketId = getSocketIdByUserId(fromUserId);
    if (!fromSocketId) {
        socket.emit('friend_invite_error', { message: 'Приглашение устарело' });
        return;
    }

    if (playerMatch.has(socket.id) || playerMatch.has(fromSocketId)) {
        socket.emit('friend_invite_error', { message: 'Игрок уже в бою' });
        return;
    }

    removeFromQueue(socket.id);
    removeFromQueue(fromSocketId);

    const [deckA, deckB] = await Promise.all([
        loadDeckForUser(socket.data.userId),
        loadDeckForUser(fromUserId)
    ]);

    if (deckA.length !== GAME_CONFIG.deckSize || deckB.length !== GAME_CONFIG.deckSize) {
        socket.emit('friend_invite_error', { message: 'Колода не готова' });
        io.to(fromSocketId).emit('friend_invite_error', { message: 'Колода не готова' });
        return;
    }

    const playerA = {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
        hp: GAME_CONFIG.health,
        energy: 0,
        hand: [],
        board: [],
        nextUid: 1,
        deck: []
    };
    playerA.deck = shuffle(deckA).map(card => makeBattleCard(playerA, card));

    const playerB = {
        socketId: fromSocketId,
        userId: fromUserId,
        username: 'Opponent',
        hp: GAME_CONFIG.health,
        energy: 0,
        hand: [],
        board: [],
        nextUid: 1,
        deck: []
    };

    try {
        const [users] = await db.query('SELECT username FROM users WHERE id = ?', [fromUserId]);
        if (users.length > 0) playerB.username = users[0].username;
    } catch (e) {
        // ignore
    }

    playerB.deck = shuffle(deckB).map(card => makeBattleCard(playerB, card));

    createMatch(io, 'friend', playerA, playerB);
    io.to(fromSocketId).emit('friend_invite_cancel');
}

function handleFriendInviteDecline(io, socket, payload) {
    const fromUserId = payload && payload.fromUserId;
    const fromSocketId = getSocketIdByUserId(fromUserId);
    if (fromSocketId) {
        io.to(fromSocketId).emit('friend_invite_error', { message: 'Приглашение отклонено' });
    }
}

function handleQueueLeave(socket) {
    removeFromQueue(socket.id);
    if (socket.data && socket.data.userId) {
        setUserStatus(socket.data.userId, 'online');
    }
    socket.emit('queue_status', { status: 'idle' });
}

function getMatchBySocket(socketId) {
    const matchId = playerMatch.get(socketId);
    if (!matchId) return null;
    return matches.get(matchId);
}

function handlePlayCard(io, socket, payload) {
    const match = getMatchBySocket(socket.id);
    if (!match) return;
    if (match.turnSocketId !== socket.id) return;

    const player = match.players.find(p => p.socketId === socket.id);
    const cardIndex = player.hand.findIndex(card => card.uid === payload.uid);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    if (card.cost > player.energy) return;

    player.energy -= card.cost;
    player.hand.splice(cardIndex, 1);
    card.summoningSick = true;
    card.hasAttacked = false;
    player.board.push(card);

    emitState(match, io);
}

function handleAttackCard(io, socket, payload) {
    const match = getMatchBySocket(socket.id);
    if (!match) return;
    if (match.turnSocketId !== socket.id) return;

    const attackerPlayer = match.players.find(p => p.socketId === socket.id);
    const defenderPlayer = match.players.find(p => p.socketId !== socket.id);
    const attacker = attackerPlayer.board.find(card => card.uid === payload.attackerUid);
    const defender = defenderPlayer.board.find(card => card.uid === payload.targetUid);
    if (!attacker || !defender) return;
    if (attacker.hasAttacked || attacker.summoningSick) return;

    attacker.currentHp -= defender.attack;
    defender.currentHp -= attacker.attack;
    attacker.hasAttacked = true;

    if (attacker.currentHp <= 0) {
        attackerPlayer.board = attackerPlayer.board.filter(card => card.uid !== attacker.uid);
    }
    if (defender.currentHp <= 0) {
        defenderPlayer.board = defenderPlayer.board.filter(card => card.uid !== defender.uid);
    }

    if (checkWin(match, io)) return;
    emitState(match, io);
}

function handleAttackAvatar(io, socket, payload) {
    const match = getMatchBySocket(socket.id);
    if (!match) return;
    if (match.turnSocketId !== socket.id) return;

    const attackerPlayer = match.players.find(p => p.socketId === socket.id);
    const defenderPlayer = match.players.find(p => p.socketId !== socket.id);
    if (defenderPlayer.board.length > 0) return;

    const attacker = attackerPlayer.board.find(card => card.uid === payload.attackerUid);
    if (!attacker || attacker.hasAttacked || attacker.summoningSick) return;

    defenderPlayer.hp -= attacker.attack;
    attacker.hasAttacked = true;

    if (checkWin(match, io)) return;
    emitState(match, io);
}

function handleEndTurn(io, socket) {
    const match = getMatchBySocket(socket.id);
    if (!match) return;
    if (match.turnSocketId !== socket.id) return;
    endTurn(match, io);
}

function handleLeaveMatch(io, socket) {
    const match = getMatchBySocket(socket.id);
    if (!match) return;
    const opponent = match.players.find(p => p.socketId !== socket.id);
    void endMatch(match, io, {
        reason: 'forfeit',
        winnerSocketId: opponent.socketId,
        loserSocketId: socket.id,
        winnerUserId: opponent.userId,
        loserUserId: socket.data.userId
    });
    setUserStatus(socket.data.userId, 'online');
    setUserStatus(opponent.userId, 'online');
}

function handleDisconnect(io, socket) {
    removeFromQueue(socket.id);
    onlineUsers.delete(Number(socket.data.userId));
    const match = getMatchBySocket(socket.id);
    if (!match) {
        setUserStatus(socket.data.userId, 'offline');
        return;
    }

    const opponent = match.players.find(p => p.socketId !== socket.id);
    void endMatch(match, io, {
        reason: 'disconnect',
        winnerSocketId: opponent.socketId,
        loserSocketId: socket.id,
        winnerUserId: opponent.userId,
        loserUserId: socket.data.userId
    });
    setUserStatus(socket.data.userId, 'offline');
    setUserStatus(opponent.userId, 'online');
}

function setupSocket(io) {
    io.on('connection', (socket) => {
        const auth = socket.handshake.auth || {};
        if (!auth.userId || !auth.username) {
            socket.emit('queue_status', { status: 'error', message: 'Unauthorized' });
            socket.disconnect(true);
            return;
        }

        socket.data.userId = auth.userId;
        socket.data.username = auth.username;
        onlineUsers.set(Number(auth.userId), socket.id);
        setUserStatus(socket.data.userId, 'online');

        socket.on('queue_join', (payload) => handleQueueJoin(io, socket, payload));
        socket.on('queue_leave', () => handleQueueLeave(socket));
        socket.on('play_card', (payload) => handlePlayCard(io, socket, payload));
        socket.on('attack_card', (payload) => handleAttackCard(io, socket, payload));
        socket.on('attack_avatar', (payload) => handleAttackAvatar(io, socket, payload));
        socket.on('end_turn', () => handleEndTurn(io, socket));
        socket.on('leave_match', () => handleLeaveMatch(io, socket));
        socket.on('friend_invite', (payload) => handleFriendInvite(io, socket, payload));
        socket.on('friend_invite_accept', (payload) => handleFriendInviteAccept(io, socket, payload));
        socket.on('friend_invite_decline', (payload) => handleFriendInviteDecline(io, socket, payload));
        socket.on('disconnect', () => handleDisconnect(io, socket));
    });
}

module.exports = { setupSocket };
