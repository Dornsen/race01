// Переключение видимости окон
function showBox(boxId) {
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    document.getElementById(boxId).classList.remove('hidden');
    document.getElementById('message').innerText = '';
}

// Навигация
document.getElementById('show-register').onclick = () => showBox('register-box');
document.getElementById('show-login').onclick = () => showBox('login-box');
document.getElementById('show-forgot').onclick = () => showBox('forgot-box');
document.querySelectorAll('.back-to-login-link').forEach(link => {
    link.onclick = () => showBox('login-box');
});

const msgBox = document.getElementById('message');

window.onload = async () => {
    try {
        const response = await fetch('/api/me');
        const result = await response.json();
        
        if (result.isLoggedIn) {
            console.log("User is logged in:", result.user.username);
            
            // Прячем все формы авторизации
            document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
            
            // Показываем сообщение и перекидываем в игру
            msgBox.style.color = '#2ecc71';
            msgBox.innerText = `Welcome back, ${result.user.username}! Loading Kiri...`;
            
            // Здесь позже добавишь код для показа игрового поля (Battlefield)
        }
    } catch (e) { 
        console.log("Анонимный вход. Ждем логина."); 
    }
};

// Переключение окон
function showBox(boxId) {
    document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
    const target = document.getElementById(boxId);
    if (target) target.classList.remove('hidden');
    msgBox.innerText = '';
}

// Навигация (убедись, что ID в HTML совпадают!)
document.getElementById('show-register').onclick = () => showBox('register-box');
document.getElementById('show-login').onclick = () => showBox('login-box');
document.getElementById('show-forgot').onclick = () => showBox('forgot-box');
document.querySelectorAll('.back-to-login-link').forEach(link => {
    link.onclick = (e) => { e.preventDefault(); showBox('login-box'); };
});

// ИСПРАВЛЕННАЯ ФУНКЦИЯ: добавили formId в аргументы
async function apiCall(endpoint, data, formId) {
    const form = document.getElementById(formId);
    if (!form) return { success: false };

    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn.innerText;

    try {
        // Блокируем кнопку от мульти-кликов
        btn.disabled = true;
        btn.innerText = 'Загрузка...'; 
        msgBox.innerText = '';

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
            return { success: false };
        }
    } catch (err) {
        msgBox.style.color = '#e74c3c';
        msgBox.innerText = 'Ошибка сервера Kiri';
        btn.disabled = false;
        btn.innerText = originalBtnText;
        return { success: false };
    } finally {
        
    }
}

// --- ОБРАБОТЧИКИ (теперь передаем 'ID-формы') ---

document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const res = await apiCall('/api/register', {
        username: document.getElementById('reg-username').value,
        email: email,
        password: document.getElementById('reg-password').value
    }, 'register-form'); // Передаем ID
    
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
        msgBox.innerText = "Вход выполнен! Загружаем Kiri...";
        // Здесь переход в игру
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