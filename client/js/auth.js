const msgBox = document.getElementById('message');

// --- 1. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ИГРОКА (ИСПРАВЛЕНО) ---
function updatePlayerUI(user) {
    if (!user) return;
    
    const greeting = document.getElementById('user-greeting');
    const mmr = document.getElementById('user-mmr');
    
    // ВАЖНО: Обновляем только те поля, которые ПРИШЛИ в объекте user
    // Это предотвращает появление "undefined"
    if (user.username && greeting) {
        greeting.innerText = `Привет, ${user.username}!`;
    }
    
    if (user.mmr !== undefined && mmr) {
        mmr.innerText = user.mmr;
    }

    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    if (avatarPlaceholder && user.avatar) {
        avatarPlaceholder.style.backgroundImage = `url('assets/${user.avatar}')`;
        avatarPlaceholder.style.backgroundSize = 'cover';
        avatarPlaceholder.style.backgroundPosition = 'center';
    }
}

// ... внутри логики выбора в сетке ...
document.querySelectorAll('.avatar-grid').forEach(grid => {
    grid.onclick = async (e) => {
        if (e.target.classList.contains('avatar-item')) {
            grid.querySelectorAll('.avatar-item').forEach(img => img.classList.remove('selected'));
            e.target.classList.add('selected');
            const selectedAvatar = e.target.getAttribute('data-avatar');

            if (grid.id === 'reg-avatar-grid') {
                document.getElementById('reg-avatar-url').value = selectedAvatar;
            } else {
                // Смена в лобби
                const res = await apiCall('/api/update-avatar', { avatar_url: selectedAvatar }, null);
                if (res.success) {
                    // Передаем только то, что изменилось — ник не затрется! 
                    updatePlayerUI({ avatar: selectedAvatar }); 
                    avatarModal.classList.add('hidden');
                }
            }
        }
    };
});
// --- 2. ПРОВЕРКА СЕССИИ ПРИ ЗАГРУЗКЕ ---
window.onload = async () => {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        
        if (result.isLoggedIn) {
            updatePlayerUI(result.user);
            showBox('main-menu');
            loadFriends();
            if (typeof fetchCardsFromDB === 'function') fetchCardsFromDB();
            if (typeof fetchMyDeck === 'function') fetchMyDeck();
        }
    } catch (e) { 
        console.log("Анонимный вход."); 
    }
};

// --- 3. ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ОКОН (С ФИКСОМ НАЛОЖЕНИЯ) ---
let friendPollInterval = null; // Переменная для хранения таймера

function showBox(boxId) {
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        if (boxId === 'main-menu') {
            mainMenu.classList.remove('hidden');
            
            // Запускаем автообновление друзей каждые 5 секунд (5000 мс)
            if (!friendPollInterval) {
                friendPollInterval = setInterval(loadFriends, 5000);
            }
        } else {
            mainMenu.classList.add('hidden');
            
            // Если вышли из лобби — убиваем таймер, чтобы не грузить сервер
            if (friendPollInterval) {
                clearInterval(friendPollInterval);
                friendPollInterval = null;
            }
        }
    }

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

// Навигация
document.getElementById('show-register').onclick = () => showBox('register-box');
document.getElementById('show-login').onclick = () => showBox('login-box');
document.getElementById('show-forgot').onclick = () => showBox('forgot-box');
document.querySelectorAll('.back-to-login-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); showBox('login-box'); };
});

// --- Вспомогательная функция для уведомлений ---
function showNotification(text, isError = false) {
    const msgBox = document.getElementById('message');
    if (!msgBox) return;

    msgBox.innerText = text;
    msgBox.style.color = isError ? '#e74c3c' : '#2ecc71';
    
    // Добавляем класс видимости
    msgBox.classList.add('show');

    // Очищаем предыдущий таймер, если он был
    if (window.msgTimeout) clearTimeout(window.msgTimeout);

    // Убираем уведомление через 3 секунды
    window.msgTimeout = setTimeout(() => {
        msgBox.classList.remove('show');
        // Очищаем текст только после завершения анимации исчезновения
        setTimeout(() => { msgBox.innerText = ''; }, 400);
    }, 3000);
}

// --- 4. УНИВЕРСАЛЬНЫЙ ЗАПРОС К СЕРВЕРУ ---
async function apiCall(endpoint, data, formId) {
    const form = document.getElementById(formId);
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    
    const originalBtnText = btn ? (btn.getAttribute('data-default') || btn.innerText) : '';
    if (btn && !btn.hasAttribute('data-default')) btn.setAttribute('data-default', originalBtnText);

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Загрузка...';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Показываем красивое уведомление вместо обычного текста
            showNotification(result.message || 'Успешно');
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
            return { success: true, data: result };
        } else {
            showNotification(result.error || 'Ошибка', true);
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalBtnText;
            }
            return { success: false };
        }
    } catch (err) {
        showNotification('Ошибка соединения', true);
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalBtnText;
        }
        return { success: false };
    }
}

// --- 5. ОБРАБОТЧИКИ ФОРМ ---

// Регистрация с выбором аватара
document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const res = await apiCall('/api/register', {
        username: document.getElementById('reg-username').value,
        email: email,
        password: document.getElementById('reg-password').value,
        avatar_url: document.getElementById('reg-avatar-url').value // Передаем аватар
    }, 'register-form'); 
    
    if (res.success) {
        document.getElementById('verify-email').value = email;
        setTimeout(() => showBox('verify-box'), 1500);
    }
};

// Вход
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
    }
};

// Остальные формы
document.getElementById('forgot-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const res = await apiCall('/api/forgot-password', { email }, 'forgot-form');
    if (res.success) {
        document.getElementById('reset-email-hidden').value = email;
        setTimeout(() => showBox('reset-box'), 1500);
    }
};

document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/reset-password', {
        email: document.getElementById('reset-email-hidden').value,
        token: document.getElementById('reset-token').value,
        newPassword: document.getElementById('reset-new-password').value
    }, 'reset-form');
    if (res.success) setTimeout(() => showBox('login-box'), 1500);
};

document.getElementById('verify-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/verify', {
        email: document.getElementById('verify-email').value,
        code: document.getElementById('verify-code').value
    }, 'verify-form');
    if (res.success) setTimeout(() => showBox('login-box'), 1500);
};

// --- 6. ЛОГИКА ЛОББИ И МОДАЛЬНОГО ОКНА ---

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            showBox('login-box'); // Теперь корректно скроет меню 
            msgBox.style.color = '#2ecc71';
            msgBox.innerText = 'Вы успешно вышли из аккаунта.';
        } catch (err) {
            console.error("Ошибка при выходе:", err);
        }
    };
}

// Модалка выбора аватара
const avatarBox = document.querySelector('.avatar-placeholder');
const avatarModal = document.getElementById('avatar-modal');

if (avatarBox) {
    avatarBox.onclick = () => avatarModal.classList.remove('hidden');
}

if (document.getElementById('close-modal')) {
    document.getElementById('close-modal').onclick = () => avatarModal.classList.add('hidden');
}

// Выбор в сетке (регистрация и лобби)
document.querySelectorAll('.avatar-grid').forEach(grid => {
    grid.onclick = async (e) => {
        if (e.target.classList.contains('avatar-item')) {
            grid.querySelectorAll('.avatar-item').forEach(img => img.classList.remove('selected'));
            e.target.classList.add('selected');
            const selectedAvatar = e.target.getAttribute('data-avatar');

            if (grid.id === 'reg-avatar-grid') {
                // Только сохраняем в скрытое поле для регистрации
                document.getElementById('reg-avatar-url').value = selectedAvatar;
            } else {
                // Смена в лобби "на лету" 
                const res = await apiCall('/api/update-avatar', { avatar_url: selectedAvatar }, null);
                if (res.success) {
                    updatePlayerUI({ avatar: selectedAvatar });
                    avatarModal.classList.add('hidden');
                }
            }
        }
    };
});

// Кнопка игры
const playBtnMain = document.getElementById('btn-play-main');
const playModes = document.getElementById('play-modes');
if (playBtnMain && playModes) {
    playBtnMain.onclick = () => playModes.classList.toggle('hidden');
}

// --- 6. ФРЕНДЛИСТ ---

// Функция загрузки и отрисовки списка друзей
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

        // 1. ОТРИСОВКА ЗАЯВОК (Pending)
        if (dataPending.requests && dataPending.requests.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = `<small style="color: #f1c40f">Новые заявки:</small>`;
            list.appendChild(head);

            dataPending.requests.forEach(req => {
                const li = document.createElement('li');
                li.className = 'friend-item pending';
                li.style = "display:flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.1)";
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

        // 2. ОТРИСОВКА ДРУЗЕЙ (Accepted)
       // 2. ОТРИСОВКА ДРУЗЕЙ (Accepted) с аватарами и Правым кликом
        if (dataFriends.friends && dataFriends.friends.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = `<small style="opacity:0.6; padding-left: 5px;">Друзья (${dataFriends.friends.length}/50):</small>`;
            list.appendChild(head);

            dataFriends.friends.forEach(f => {
                const li = document.createElement('li');
                li.className = 'friend-item';
                
                // Дефолтный аватар, если у юзера его нет
                const avatarImg = f.avatar_url ? f.avatar_url : 'avatar1.png'; 
                
                li.innerHTML = `
                    <div class="friend-info">
                        <img src="assets/${avatarImg}" class="friend-avatar" alt="ava">
                        <span>${f.username}</span>
                    </div>
                    <span style="color: ${f.status === 'online' ? '#2ecc71' : '#7f8c8d'}; font-size: 0.8rem;">●</span>
                `;
                
                // ОБРАБОТЧИК ПРАВОЙ КНОПКИ МЫШИ (ПКМ)
                li.oncontextmenu = (e) => {
                    e.preventDefault(); // Отключаем стандартное меню браузера
                    showFriendMenu(e.pageX, e.pageY, f.id, f.username);
                };
                
                list.appendChild(li);
            });
        } else if (!dataPending.requests || dataPending.requests.length === 0) {
            list.innerHTML = '<li class="empty-friends">Список пуст</li>';
        }

    } catch (e) { console.error("Ошибка френдлиста", e); }
}

// Универсальная функция для кнопок Принять/Отклонить
window.handleFriend = async (id, action) => {
    const res = await fetch('/api/friends/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: id, action: action })
    });
    const result = await res.json();
    showNotification(result.message || result.error, res.ok ? 'success' : 'error');
    if (res.ok) loadFriends(); // Обновляем список
};

// Кнопка добавления друга (+)
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
            
            // Используем твою готовую функцию showNotification!
            showNotification(result.message || result.error, res.ok ? 'success' : 'error');
            
            if (res.ok) {
                input.value = ''; // Очищаем поле
                loadFriends();    // Сразу обновляем список на экране
            }
        } catch (e) {
            showNotification('Ошибка соединения', 'error');
        }
    };
}


// --- 7. КОНТЕКСТНОЕ МЕНЮ ДРУЗЕЙ ---
const ctxMenu = document.getElementById('friend-context-menu');
let selectedTargetId = null;
let selectedTargetName = null;

function showFriendMenu(x, y, friendId, friendName) {
    selectedTargetId = friendId;
    selectedTargetName = friendName;
    
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');
}

// Скрываем меню при клике в любое другое место
document.addEventListener('click', (e) => {
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
        ctxMenu.classList.add('hidden');
    }
});

// Кнопка "Предложить бой"
const btnInvite = document.getElementById('ctx-invite');
if (btnInvite) {
    btnInvite.onclick = () => {
        // Здесь позже будет вызов WebSockets или создание комнаты
        showNotification(`Запрос на бой отправлен игроку ${selectedTargetName}!`);
    };
}

// Кнопка "Удалить"
const btnRemove = document.getElementById('ctx-remove');
if (btnRemove) {
    btnRemove.onclick = async () => {
        if (!confirm(`Вы точно хотите удалить ${selectedTargetName} из друзей?`)) return;
        
        try {
            const res = await fetch('/api/friends/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendId: selectedTargetId })
            });
            const result = await res.json();
            showNotification(result.message || result.error, res.ok ? 'success' : 'error');
            if (res.ok) loadFriends(); // Обновляем список сразу
        } catch (e) {
            showNotification('Ошибка удаления', true);
        }
    };
}