let selectedAvatarPath = null;
let avatarsLoaded = false;
let pendingMusicEnabled = null;
let pendingMusicVolume = null;

function notify(text, isError = false) {
    if (typeof showNotification === 'function') {
        showNotification(text, isError);
    }

    const status = document.getElementById('settings-status');
    if (status) {
        status.innerText = text;
        status.classList.remove('is-success', 'is-error');
        status.classList.add(isError ? 'is-error' : 'is-success');
    }

    if (typeof showNotification !== 'function') {
        alert(text);
    }
}

function getCurrentAvatarName() {
    if (window.currentUserAvatar) return window.currentUserAvatar;

    const avatarImg = document.getElementById('lobby-avatar-img');
    if (avatarImg && avatarImg.src) {
        const match = avatarImg.src.match(/([^/\\]+\.(?:png|jpe?g|webp|gif))(?:\?.*)?$/i);
        if (match) return match[1];
    }

    return 'avatar1.png';
}

function syncMusicControls() {
    const music = document.getElementById('bg-music');
    const volumeSlider = document.getElementById('music-volume');
    const musicToggle = document.getElementById('music-toggle');
    const volumeValue = document.getElementById('music-volume-value');

    if (!music || !volumeSlider || !musicToggle) return;

    const savedVolume = pendingMusicVolume !== null ? Number(pendingMusicVolume) : Number(localStorage.getItem('game_music_volume') || 0.5);
    const isMusicPlaying = pendingMusicEnabled !== null ? Boolean(pendingMusicEnabled) : localStorage.getItem('game_music_playing') === 'true';

    music.volume = savedVolume;
    volumeSlider.value = savedVolume;
    musicToggle.checked = isMusicPlaying;

    if (volumeValue) {
        volumeValue.innerText = `${Math.round(savedVolume * 100)}%`;
    }
}

function applyMusicSettingsFromServer(user) {
    if (!user) return;

    if (Object.prototype.hasOwnProperty.call(user, 'music_enabled')) {
        localStorage.setItem('game_music_playing', user.music_enabled ? 'true' : 'false');
    }

    if (Object.prototype.hasOwnProperty.call(user, 'music_volume')) {
        localStorage.setItem('game_music_volume', String(user.music_volume));
    }

    syncMusicControls();
}

window.applyMusicSettingsFromServer = applyMusicSettingsFromServer;

function syncMusicPlayback() {
    const music = document.getElementById('bg-music');
    if (!music) return;

    syncMusicControls();

    const shouldPlay = pendingMusicEnabled !== null ? pendingMusicEnabled : localStorage.getItem('game_music_playing') === 'true';
    if (!shouldPlay) {
        music.pause();
        return;
    }

    const tryPlay = () => music.play().catch(() => {
        if (window.__musicResumeListenerAttached) return;
        window.__musicResumeListenerAttached = true;

        const resume = () => {
            window.__musicResumeListenerAttached = false;
            music.play().catch(() => {});
        };

        document.addEventListener('pointerdown', resume, { once: true });
        document.addEventListener('keydown', resume, { once: true });
    });

    tryPlay();
}

window.syncMusicPlayback = syncMusicPlayback;

// Switch between menu and battle music tracks
function switchMusicTrack(trackName) {
    const music = document.getElementById('bg-music');
    if (!music) return;

    const isMusicEnabled = localStorage.getItem('game_music_playing') === 'true';
    if (!isMusicEnabled) {
        music.pause();
        return;
    }

    const validTracks = ['menu', 'battle'];
    const track = validTracks.includes(trackName) ? trackName : 'menu';
    
    const trackPath = `assets/music/${track}.mp3`;
    if (music.src !== trackPath) {
        music.src = trackPath;
        music.play().catch(() => {
            // Fallback if autoplay is blocked
        });
    }
}

window.switchMusicTrack = switchMusicTrack;

// Инициализация звука при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    syncMusicControls();
});

// Открытие окна настроек
async function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');

    const status = document.getElementById('settings-status');
    if (status) {
        status.innerText = '';
        status.classList.remove('is-success', 'is-error');
    }

    if (modal.classList.contains('hidden')) {
        pendingMusicEnabled = null;
        pendingMusicVolume = null;
    }

    if (!modal.classList.contains('hidden') && !avatarsLoaded) {
        await loadAvatars();
    }

    if (!modal.classList.contains('hidden')) {
        syncMusicControls();
    }
}

// Загрузка и рендер аватарок
async function loadAvatars() {
    try {
        const res = await fetch('/api/avatars');
        const data = await res.json();

        if (data.avatars) {
            const grid = document.getElementById('avatar-grid');
            grid.innerHTML = ''; 
            const currentAvatar = getCurrentAvatarName();
            selectedAvatarPath = currentAvatar;

            data.avatars.forEach(avatarFileName => {
                const img = document.createElement('img');
                img.src = `assets/avatars/${avatarFileName}`;
                img.className = 'avatar-option';
                img.onclick = (e) => selectAvatar(avatarFileName, e.target);
                if (avatarFileName === currentAvatar) {
                    img.classList.add('selected');
                }
                grid.appendChild(img);
            });
            
            avatarsLoaded = true;
        }
    } catch (err) {
        console.error('Ошибка при загрузке списка аватаров:', err);
    }
}

// Функция выбора аватара
function selectAvatar(avatarName, targetElement) {
    selectedAvatarPath = avatarName;
    const avatars = document.querySelectorAll('.avatar-option');
    avatars.forEach(img => img.classList.remove('selected'));
    targetElement.classList.add('selected');
}

// Сохранение аватара
async function saveAvatar() {
    if (!selectedAvatarPath) return notify('Выберите аватар!', true); 

    return saveAvatarInternal(true, true);
}

async function saveAvatarInternal(closeModal = true, showMessage = true) {
    if (!selectedAvatarPath) return;

    try {
        const res = await fetch('/api/update-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ avatar_url: selectedAvatarPath })
        });
        const data = await res.json();
        
        if (res.ok) {
            window.currentUserAvatar = selectedAvatarPath;
            if (typeof updatePlayerUI === 'function') {
                updatePlayerUI({ avatar: selectedAvatarPath });
            }
            if (showMessage) {
                notify(data.message || 'Avatar updated successfully!');
            }
            if (closeModal) {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.classList.add('hidden');
            }
            return true;
        } else {
            if (showMessage) {
                notify(data.error || 'Ошибка при смене аватара', true);
            }
            return false;
        }
    } catch (err) {
        console.error(err);
        if (showMessage) {
            notify('Ошибка при смене аватара', true);
        }
        return false;
    }
}

// Переключатель музыки (Вкл/Выкл)
function toggleMusic() {
    const music = document.getElementById('bg-music');
    const isChecked = document.getElementById('music-toggle').checked;
    pendingMusicEnabled = isChecked;
    
    if (isChecked) {
        syncMusicPlayback();
    } else {
        if (music) music.pause();
    }
}

// Ползунок громкости
function changeVolume() {
    const music = document.getElementById('bg-music');
    const volumeSlider = document.getElementById('music-volume');
    const volumeValue = document.getElementById('music-volume-value');
    
    if (music && volumeSlider) {
        const newVolume = volumeSlider.value;
        music.volume = Number(newVolume);
        pendingMusicVolume = Number(newVolume);
        if (volumeValue) {
            volumeValue.innerText = `${Math.round(Number(newVolume) * 100)}%`;
        }
    }
}

let musicSettingsSaveTimer = null;

async function saveMusicSettings() {
    const music = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');

    if (!music || !musicToggle) return;

    const enabled = pendingMusicEnabled !== null ? pendingMusicEnabled : musicToggle.checked;
    const volume = pendingMusicVolume !== null ? pendingMusicVolume : Number(music.volume);

    const res = await fetch('/api/update-music-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            musicEnabled: enabled,
            musicVolume: Number(volume)
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ошибка при сохранении музыки');
    }

    return true;
}

async function saveSettings() {
    const currentAvatar = getCurrentAvatarName();

    try {
        if (selectedAvatarPath && selectedAvatarPath !== currentAvatar) {
            const avatarSaved = await saveAvatarInternal(false, false);
            if (!avatarSaved) return;
        }

        await saveMusicSettings();

        const savedEnabled = pendingMusicEnabled !== null ? pendingMusicEnabled : document.getElementById('music-toggle').checked;
        const savedVolume = pendingMusicVolume !== null ? pendingMusicVolume : Number(document.getElementById('music-volume').value);
        localStorage.setItem('game_music_playing', savedEnabled ? 'true' : 'false');
        localStorage.setItem('game_music_volume', String(savedVolume));
        pendingMusicEnabled = null;
        pendingMusicVolume = null;

        notify('Settings saved successfully!');
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
    } catch (err) {
        console.error(err);
        notify(err.message || 'Ошибка при сохранении настроек', true);
    }
}

// Смена пароля
async function changePassword() {
    const oldPassword = document.getElementById('old-password').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();

    // ЗАМЕНЕНО: alert на notify
    if (!oldPassword || !newPassword) return notify('Заполните оба поля!', true); 

    try {
        const res = await fetch('/api/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        notify(data.message || data.error, !res.ok);
        
        if (res.ok) {
            document.getElementById('old-password').value = '';
            document.getElementById('new-password').value = '';
        }
    } catch (err) {
        console.error(err);
        notify('Ошибка при смене пароля', true);
    }
}

// Удаление аккаунта
let deleteStep = 1;

// Вызывается при нажатии на кнопку "Delete Account" в настройках
function deleteAccount() {
    deleteStep = 1;
    const modal = document.getElementById('account-delete-modal');
    const title = document.getElementById('delete-modal-title');
    const text = document.getElementById('delete-modal-text');
    const proceedBtn = document.getElementById('btn-delete-proceed');

    if (!modal || !text || !proceedBtn) {
        return notify('Account deletion feature is temporarily unavailable.', true);
    }

    // Шаг 1: Первое предупреждение
    title.innerText = "Warning";
    text.innerText = "Are you sure? This action will permanently delete your account, all cards, and your rating!";
    modal.classList.remove('hidden');

    // Назначаем действие на кнопку согласия
    proceedBtn.onclick = handleDeleteClick;
}

// Управляет шагами внутри модального окна
function handleDeleteClick() {
    const title = document.getElementById('delete-modal-title');
    const text = document.getElementById('delete-modal-text');

    if (deleteStep === 1) {
        // Переходим к Шагу 2: Окончательное предупреждение
        deleteStep = 2;
        title.innerText = "Final Confirmation";
        text.innerText = "DELETE FOR SURE? There is no going back.";
    } else if (deleteStep === 2) {
        // Если оба шага пройдены — отправляем запрос на сервер
        executeAccountDeletion();
    }
}

// Непосредственно удаление на бэкенде
async function executeAccountDeletion() {
    try {
        const res = await fetch('/api/delete-account', { method: 'DELETE', credentials: 'same-origin' });
        const data = await res.json();
        
        if (res.ok) {
            closeDeleteAccountModal();
            notify(data.message || 'Account deleted. Farewell!');
            
            // Небольшая задержка, чтобы игрок успел прочесть уведомление прощания
            setTimeout(() => {
                window.location.href = '/'; 
            }, 1500);
        } else {
            notify(data.error || 'Error deleting account.', true);
            closeDeleteAccountModal();
        }
    } catch (err) {
        console.error(err);
        notify('Error deleting account.', true);
        closeDeleteAccountModal();
    }
}

// Закрытие модального окна при отмене
function closeDeleteAccountModal() {
    const modal = document.getElementById('account-delete-modal');
    if (modal) modal.classList.add('hidden');
    deleteStep = 1; // Сбрасываем шаги
}

// --- ИНТЕРАКТИВНЫЙ РАЗВОРАЧИВАЮЩИЙСЯ СВИТОК ---
document.addEventListener('DOMContentLoaded', () => {
    const handle = document.getElementById('scroll-drag-handle');
    const paper = document.getElementById('scroll-paper');
    const container = document.getElementById('scroll-body');
    const volumeInput = document.getElementById('music-volume');
    const volumeValue = document.getElementById('music-volume-value');
    const music = document.getElementById('bg-music');

    if (!handle || !paper || !container) return;

    let isDragging = false;
    const maxScrollWidth = 200; // Максимальная ширина разворачивания холста в пикселях

    function updateScrollPosition(clientX) {
        const containerRect = container.getBoundingClientRect();
        // Считаем, сколько пикселей протащили от левого края (где стоит левый валик)
        let width = clientX - containerRect.left;

        // Зажимаем границы движения от 0 до максимума
        if (width < 0) width = 0;
        if (width > maxScrollWidth) width = maxScrollWidth;

        // Рассчитываем процент громкости от 0.0 до 1.0
        const volume = width / maxScrollWidth;

        // Физически меняем ширину пергамента на экране
        paper.style.width = `${width}px`;
        
        // Меняем прозрачность текста внутри свитка в зависимости от раскрытия
        const glowText = paper.querySelector('.scroll-glow-text');
        if (glowText) glowText.style.opacity = volume;

        // Синхронизируем со звуковой системой игры
        if (music) music.volume = volume;
        if (volumeInput) volumeInput.value = volume;
        if (volumeValue) volumeValue.innerText = `${Math.round(volume * 100)}%`;

        pendingMusicVolume = volume;
    }

    // Слушатели событий мыши и сенсора
    handle.addEventListener('mousedown', () => isDragging = true);
    handle.addEventListener('touchstart', () => isDragging = true, { passive: true });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) updateScrollPosition(e.clientX);
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) {
            updateScrollPosition(e.touches[0].clientX);
        }
    }, { passive: false });

    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('touchend', () => isDragging = false);

    // Поддержка синхронизации при открытии окна настроек
    const oldSyncControls = window.syncMusicControls;
    window.syncMusicControls = function() {
        if (typeof oldSyncControls === 'function') oldSyncControls();
        
        const vol = Number(document.getElementById('music-volume').value || 0.5);
        const targetWidth = vol * maxScrollWidth;
        
        if (paper) paper.style.width = `${targetWidth}px`;
        const glowText = paper.querySelector('.scroll-glow-text');
        if (glowText) glowText.style.opacity = vol;
    };
});