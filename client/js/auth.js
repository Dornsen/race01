const msgBox = document.getElementById('message');

// --- 1. ПРОВЕРКА СЕССИИ ПРИ ЗАГРУЗКЕ ---
window.onload = async () => {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        
        if (result.isLoggedIn) {
            document.getElementById('user-greeting').innerText = `Привет, ${result.user.username}!`;
            document.getElementById('user-mmr').innerText = result.user.mmr || 1000;
            showBox('main-menu');
        }
    } catch (e) { 
        console.log("Анонимный вход."); 
    }
};

// --- 2. ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ОКОН (С АВТО-ОЧИСТКОЙ) ---
function showBox(boxId) {
    // 1. Скрываем все окна
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    
    // 2. ВАЖНО: Сбрасываем поля и размораживаем кнопки во всех формах!
    document.querySelectorAll('form').forEach(form => {
        form.reset(); // Очищает введенные логины/пароли
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = false; // Возвращаем кнопку к жизни
            if (btn.hasAttribute('data-default')) {
                btn.innerText = btn.getAttribute('data-default'); // Возвращаем старый текст
            }
        }
    });

    // 3. Показываем нужное окно
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

// --- 3. ПУЛЕНЕПРОБИВАЕМЫЙ ЗАПРОС К СЕРВЕРУ ---
async function apiCall(endpoint, data, formId) {
    const form = document.getElementById(formId);
    if (!form) return { success: false };

    const btn = form.querySelector('button[type="submit"]');
    
    // Сохраняем оригинальный текст кнопки один раз
    if (!btn.hasAttribute('data-default')) {
        btn.setAttribute('data-default', btn.innerText);
    }
    const originalBtnText = btn.getAttribute('data-default');

    try {
        btn.disabled = true;
        btn.innerText = 'Загрузка...'; 
        msgBox.innerText = '';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Читаем ответ как текст, чтобы не сломаться, если сервер упал
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error('Сервер вернул неверный формат (не JSON)');
        }
        
        if (response.ok) {
            msgBox.style.color = '#2ecc71';
            msgBox.innerText = result.message;
            return { success: true, data: result }; 
            // Кнопка остается отключенной, пока showBox её не разморозит
        } else {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = result.error || 'Ошибка';
            btn.disabled = false;
            btn.innerText = originalBtnText;
            return { success: false };
        }
    } catch (err) {
        console.error(err);
        msgBox.style.color = '#e74c3c';
        msgBox.innerText = 'Ошибка соединения с сервером';
        btn.disabled = false;
        btn.innerText = originalBtnText;
        return { success: false };
    }
}

// --- 4. ОБРАБОТЧИКИ ---
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
        document.getElementById('user-greeting').innerText = `Привет, ${res.data.user.username}!`;
        document.getElementById('user-mmr').innerText = res.data.user.mmr || 1000;
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
        try {
            await fetch('/api/logout', { method: 'POST' });
            showBox('login-box');
            msgBox.style.color = '#2ecc71';
            msgBox.innerText = 'Вы успешно вышли из аккаунта.';
        } catch (err) {
            console.error("Ошибка при выходе:", err);
        }
    };
}

// --- ЛОГИКА ГЛАВНОГО МЕНЮ ---
const playBtnMain = document.getElementById('btn-play-main');
const playModes = document.getElementById('play-modes');

if (playBtnMain && playModes) {
    playBtnMain.onclick = () => {
        // Переключаем видимость меню режимов при клике на ИГРАТЬ
        playModes.classList.toggle('hidden');
    };
}