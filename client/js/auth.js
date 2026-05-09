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
        }
    } catch (e) { 
        console.log("Анонимный вход."); 
    }
};

// --- 3. ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ОКОН (С ФИКСОМ НАЛОЖЕНИЯ) ---
function showBox(boxId) {
    // Скрываем все окна авторизации
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    
    // ВАЖНО: Скрываем главное меню, если переходим к окнам входа/регистрации
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');

    // Сбрасываем формы и размораживаем кнопки
    document.querySelectorAll('form').forEach(form => {
        form.reset();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            if (btn.hasAttribute('data-default')) {
                btn.innerText = btn.getAttribute('data-default');
            }
        }
    });

    // Показываем нужное окно (либо лобби, либо окно авторизации)
    const target = document.getElementById(boxId);
    if (target) target.classList.remove('hidden');
    msgBox.innerText = '';
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