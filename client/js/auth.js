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

// Универсальная функция для Fetch
async function apiCall(endpoint, data) {
    try {
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
            msgBox.innerText = result.error || 'Operation failed';
            return { success: false };
        }
    } catch (err) {
        msgBox.innerText = 'Server error';
        return { success: false };
    }
}

// --- Обработчики форм ---

// Регистрация
document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const res = await apiCall('/api/register', {
        username: document.getElementById('reg-username').value,
        email: email,
        password: document.getElementById('reg-password').value
    });
    if (res.success) {
        document.getElementById('verify-email').value = email; // Сохраняем для верификации
        setTimeout(() => showBox('verify-box'), 1500);
    }
};

// Верификация
document.getElementById('verify-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/verify', {
        email: document.getElementById('verify-email').value,
        code: document.getElementById('verify-code').value
    });
    if (res.success) {
        setTimeout(() => showBox('login-box'), 1500);
    }
};

// Логин
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/login', {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
    });
    if (res.success) {
        msgBox.innerText = "Welcome, Avenger! Entering battlefield...";
        // Здесь можно сохранить данные в localStorage и перенаправить в лобби
    }
};

// Запрос сброса пароля
document.getElementById('forgot-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const res = await apiCall('/api/forgot-password', { email });
    if (res.success) {
        document.getElementById('reset-email-hidden').value = email;
        setTimeout(() => showBox('reset-box'), 1500);
    }
};

// Сброс пароля
document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await apiCall('/api/reset-password', {
        email: document.getElementById('reset-email-hidden').value,
        token: document.getElementById('reset-token').value,
        newPassword: document.getElementById('reset-new-password').value
    });
    if (res.success) {
        setTimeout(() => showBox('login-box'), 1500);
    }
};