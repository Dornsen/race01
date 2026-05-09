const msgBox = document.getElementById('message');

// --- 1. ПРОВЕРКА СЕССИИ ПРИ ЗАГРУЗКЕ ---
window.onload = async () => {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        
        if (result.isLoggedIn) {
            updateUI(result.user);
            showBox('main-menu');
        }
    } catch (e) { 
        console.log("Анонимный вход."); 
    }
};

// Вспомогательная функция для обновления данных игрока в лобби
function updateUI(user) {
    document.getElementById('user-greeting').innerText = `Привет, ${user.username}!`;
    document.getElementById('user-mmr').innerText = user.mmr || 1000;
    
    // Устанавливаем аватарку (если в базе пусто, ставим 1-ю по умолчанию)
    const avatarFile = user.avatar || 'avatar1.png';
    const placeholder = document.querySelector('.avatar-placeholder');
    if (placeholder) {
        placeholder.style.backgroundImage = `url('assets/${avatarFile}')`;
        placeholder.style.backgroundSize = 'cover';
        placeholder.style.backgroundPosition = 'center';
    }
}

// --- 2. ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ОКОН (ФИКС НАЛОЖЕНИЯ) ---
function showBox(boxId) {
    // Скрываем все блоки авторизации
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    
    // Скрываем главное меню (чтобы не было наложения при выходе)
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');
    
    // Сбрасываем формы
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

    // Показываем целевое окно
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

// --- 3. УНИВЕРСАЛЬНЫЙ API ВЫЗОВ ---
async function apiCall(endpoint, data, formId) {
    const form = document.getElementById(formId);
    const btn = form.querySelector('button[type="submit"]');
    
    if (!btn.hasAttribute('data-default')) {
        btn.setAttribute('data-default', btn.innerText);
    }

    try {
        btn.disabled = true;
        btn.innerText = 'Загрузка...';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            msgBox.style.color = '#2ecc71';
            msgBox.innerText = result.message;
            return { success: true, data: result }; 
        } else {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = result.error || 'Ошибка';
            btn.disabled = false;
            btn.innerText = btn.getAttribute('data-default');
            return { success: false };
        }
    } catch (err) {
        msgBox.style.color = '#e74c3c';
        msgBox.innerText = 'Ошибка сервера';
        btn.disabled = false;
        return { success: false };
    }
}

// --- 4. ОБРАБОТЧИКИ ФОРМ ---

// Регистрация БЕЗ аватара
document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const res = await apiCall('/api/register', {
        username: document.getElementById('reg-username').value,
        email: email,
        password: document.getElementById('reg-password').value
    }, 'register-form'); 
    
    if (res.success) {
        document.getElementById('verify-email').value = email;
        setTimeout(() => showBox('verify-box'), 1500);
    }
};

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/login', {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
    }, 'login-form');
    
    if (res.success) {
        updateUI(res.data.user);
        showBox('main-menu');
    }
};

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

// --- 5. ВЫХОД (LOGOUT) ---
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await fetch('/api/logout', { method: 'POST' });
        showBox('login-box');
        msgBox.style.color = '#2ecc71';
        msgBox.innerText = 'Вы вышли из системы.';
    };
}

// --- 6. ЛОГИКА ЛОББИ И АВАТАРОВ ---
const avatarModal = document.getElementById('avatar-modal');
const avatarPlaceholder = document.querySelector('.avatar-placeholder');

// Открыть выбор аватара
if (avatarPlaceholder) {
    avatarPlaceholder.onclick = () => avatarModal.classList.remove('hidden');
}

// Закрыть выбор аватара
const closeAvatarBtn = document.getElementById('close-avatar-modal');
if (closeAvatarBtn) {
    closeAvatarBtn.onclick = () => avatarModal.classList.add('hidden');
}

// Клик по картинке в модалке
document.querySelectorAll('.avatar-item').forEach(item => {
    item.onclick = async () => {
        const newAvatar = item.getAttribute('data-avatar');
        
        const response = await fetch('/api/update-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url: newAvatar })
        });

        if (response.ok) {
            avatarPlaceholder.style.backgroundImage = `url('assets/${newAvatar}')`;
            avatarModal.classList.add('hidden');
        }
    };
});

// Кнопка ИГРАТЬ
const playBtnMain = document.getElementById('btn-play-main');
const playModes = document.getElementById('play-modes');
if (playBtnMain) {
    playBtnMain.onclick = () => playModes.classList.toggle('hidden');
}