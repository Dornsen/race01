document.addEventListener('DOMContentLoaded', () => {
    const questsContainer = document.getElementById('quests');
    const btnBackQuests = document.getElementById('btn-back-quests');
    const questsBody = document.querySelector('.quests-body');
    
    const btnOpenQuests = document.getElementById('btn-quests'); 

    if (!questsContainer || !btnBackQuests || !questsBody) return;

    if (btnOpenQuests) {
        btnOpenQuests.addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            questsContainer.classList.remove('hidden');
            loadQuests();
        });
    }

    btnBackQuests.addEventListener('click', () => {
        questsContainer.classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
    });

    async function loadQuests() {
        try {
            questsBody.innerHTML = '<div class="quest-card"><div class="quest-title">Loading...</div></div>';
            const response = await fetch('/api/quests');
            if (!response.ok) throw new Error('Network error');
            
            const quests = await response.json();
            renderQuests(quests);
        } catch (error) {
            console.error('Error loading quests:', error);
            questsBody.innerHTML = '<div class="quest-card"><div class="quest-title">Error loading quests</div></div>';
        }
    }

    function renderQuests(quests) {
        questsBody.innerHTML = '';
        
        const activeQuests = quests.filter(q => !q.is_claimed);

        if (activeQuests.length === 0) {
            questsBody.innerHTML = '<div class="quest-card"><div class="quest-title">All quests completed!</div><div class="quest-desc">Come back later.</div></div>';
            return;
        }

        const dailyQuests = activeQuests.filter(q => q.quest_type === 'daily');
        const weeklyQuests = activeQuests.filter(q => q.quest_type === 'weekly');
        const achievements = activeQuests.filter(q => q.quest_type === 'achievement');

        const renderSection = (title, list) => {
            if (list.length === 0) return '';
            
            let html = `<h3 class="quest-category-title">${title}</h3>`;
            
            list.forEach(quest => {
                const progressPercent = Math.min((quest.current_progress / quest.target_amount) * 100, 100);
                const isDone = quest.is_completed;
                
                html += `
                    <div class="quest-card ${isDone ? 'completed' : ''}">
                        <div class="quest-info">
                            <div class="quest-title">${quest.title}</div>
                            <div class="quest-desc">${quest.description}</div>
                            
                            <div class="quest-progress-wrap">
                                <div class="quest-progress-bar" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="quest-progress-text">${quest.current_progress} / ${quest.target_amount}</div>
                        </div>

                        <div class="quest-reward-zone">
                            <div class="quest-reward">⛩️ ${quest.reward_coins}</div>
                            <button class="quest-claim-btn" ${!isDone ? 'disabled' : ''} onclick="claimReward(${quest.id})">
                                ${isDone ? 'Claim' : 'In progress'}
                            </button>
                        </div>
                    </div>
                `;
            });
            return html;
        };

        questsBody.innerHTML += renderSection('Daily Quests', dailyQuests);
        questsBody.innerHTML += renderSection('Weekly Quests', weeklyQuests);
        questsBody.innerHTML += renderSection('Achievements', achievements);
    }
});

window.claimReward = async function(questId) {
    try {
        const response = await fetch('/api/quests/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Reward claimed: ⛩️ ${data.reward}`);

            document.getElementById('btn-quests').click(); 
        } else {
            alert(data.error || 'Error claiming reward');
        }
    } catch (error) {
        console.error('Claim error:', error);
    }
};