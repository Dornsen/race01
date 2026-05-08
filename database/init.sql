CREATE DATABASE IF NOT EXISTS KIRIdatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE KIRIdatabase;

-- 1. Таблица версий
CREATE TABLE IF NOT EXISTS schema_version (
    id INT PRIMARY KEY,
    version INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO schema_version (id, version) VALUES (1, 1);

-- 2. Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avatar_url VARCHAR(255) NOT NULL DEFAULT 'AVATAR.PNG',
    status ENUM('online', 'offline', 'away', 'in battle', 'searching for battle') DEFAULT 'offline',
    games_played INT DEFAULT 0,
    games_won INT DEFAULT 0,
    match_making_rating INT DEFAULT 1000,
    verification_code VARCHAR(6) DEFAULT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_token_expires DATETIME DEFAULT NULL
);

-- 3. Таблица карт (добавлено UNIQUE на name)
CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    avatar_url VARCHAR(255) NOT NULL,
    attack INT NOT NULL,
    cost INT NOT NULL,
    defense INT NOT NULL,
    rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL,
    is_basic BOOLEAN NOT NULL DEFAULT FALSE,
    clan VARCHAR(50) NOT NULL,
    ability_code VARCHAR(50) NOT NULL,
    ability_description TEXT NOT NULL
);

-- 4. Таблица инвентаря
CREATE TABLE IF NOT EXISTS user_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_card (user_id, card_id) 
);

-- 5. Таблица деки
CREATE TABLE IF NOT EXISTS active_decks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_deck_card (user_id, card_id) 
);

-- 6. Таблица друзей
CREATE TABLE IF NOT EXISTS friendships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id)
);

-- 7. Вставка и синхронизация карт (Оптимизированный вариант)
INSERT INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) VALUES
-- 🟢 COMMON
('Kodama', 'Tiny forest spirits that dwell in ancient trees. Their presence brings peace to the fractured world.', 'kodama.png', 1, 1, 2, 'common', TRUE, 'Wild Spirits', 'HEAL_AVATAR', 'Harmony: Restores 1 HP to your avatar at the end of the turn.'),
('Kappa', 'Playful water imps with a hollow in their head. They are as tricky as the rivers they inhabit.', 'kappa.png', 2, 2, 3, 'common', TRUE, 'Wild Spirits', 'DEBUFF_ATK_1', 'Humidity: Lowers a random enemy\'s attack by 1 when played.'),
('Tanuki', 'Masters of disguise and mischief. They use their magic to blend into the chaos of the memory.', 'tanuki.png', 2, 2, 2, 'common', TRUE, 'Wild Spirits', 'COPY_WEAK_ATK', 'Mimicry: Copies the attack of a random weak enemy card.'),
('Kitsune', 'Wise foxes with multiple tails. Their illusions are so vivid that even reality itself is fooled.', 'kitsune.png', 3, 3, 2, 'common', TRUE, 'Wild Spirits', 'IGNORE_FIRST_DMG', 'Illusion: Ignores the first instance of damage received.'),
('Karasu-Tengu', 'Crow-headed warriors who strike like a bolt of lightning from the darkened skies.', 'karasu-tengu.png', 4, 3, 1, 'common', TRUE, 'Elemental Sovereigns', 'RUSH', 'Rush: Can attack on the same turn it is played.'),
('Yuki-onna', 'A spirit of the snow who freezes the hearts of those lost in the winter fractures.', 'yuki-onna.png', 3, 4, 4, 'common', TRUE, 'Shadow Realm', 'FREEZE_TARGET', 'Freeze: Target enemy card cannot attack for 1 turn.'),
('Zashiki-warashi', 'A protective child spirit of the house. While they stay, the home prospers; when they leave, new memories take their place.', 'zashiki-warashi.png', 3, 4, 3, 'common', TRUE, 'Wild Spirits', 'DEATH_SUMMON_COMMON', 'Legacy: Summons a random Common card upon death.'),
-- 🔵 RARE 
('Komainu', 'Lion-dogs that guard sacred shrines. No fracture can break their unwavering resolve to protect.', 'komainu.png', 2, 4, 6, 'rare', TRUE, 'Celestial Court', 'TAUNT', 'Taunt: Enemies must attack this card first.'),
('Ronin Ghost', 'A masterless samurai who wanders the void, seeking a purpose in the broken memories.', 'ronin_ghost.png', 5, 5, 3, 'rare', TRUE, 'Shadow Realm', 'BUFF_ON_ALLY_DEATH', 'Vengeance: Gains +2 ATK if a friendly card died this turn.'),
('Jorogumo', 'A spider-woman who weaves threads of destiny to trap the unwary and aid her allies.', 'jorogumo.png', 5, 6, 5, 'rare', TRUE, 'Shadow Realm', 'REDUCE_NEXT_COST', 'Web: Reduces the cost of your next played card by 1.'),
('Inari', 'The deity of prosperity and foxes. Her presence rejuvenates the soil of the soul.', 'inari.png', 4, 5, 6, 'rare', FALSE, 'Celestial Court', 'BUFF_KITSUNE_ALL', 'Blessing: Grants +1/+1 to all friendly Kitsune cards on the field.'),
('Bake-neko', 'A cat that has lived long enough to gain supernatural powers and toy with death itself.', 'bake-neko.png', 3, 5, 5, 'rare', FALSE, 'Shadow Realm', 'RETURN_FROM_GRAVE', 'Recall: Returns a random card from the graveyard to your hand.'),
('Tengu Guard', 'Elite protectors of the mountain peaks, using the wind to deflect magical interference.', 'tengu_guard.png', 4, 6, 5, 'rare', FALSE, 'Elemental Sovereigns', 'SHIELD_ADJACENT', 'Shield: Protects adjacent cards from enemy abilities.'),
('Namazu', 'A giant catfish whose movements cause the earth to tremble and reality to crack.', 'namazu.png', 5, 7, 7, 'rare', FALSE, 'Elemental Sovereigns', 'CREATE_RIFT', 'Fracture: Creates a battlefield rift when damaged.'),
-- 🟣 EPIC 
('Bake-kujira', 'The skeletal ghost of a whale that brings a haunting song to the shores of the afterlife.', 'bake-kujira.png', 4, 6, 7, 'epic', FALSE, 'Shadow Realm', 'DEATH_AOE_1', 'Echo: Deals 1 damage to all enemy cards upon death.'),
('Raijin', 'The god of thunder who beats his drums to shake the very foundations of the world.', 'raijin.png', 6, 6, 4, 'epic', FALSE, 'Elemental Sovereigns', 'DMG_RANDOM_3', 'Discharge: Deals 3 damage to a random enemy card.'),
('Fujin', 'The god of wind who carries the tempests in his bag, ready to blow away any obstacle.', 'fujin.png', 5, 6, 5, 'epic', FALSE, 'Elemental Sovereigns', 'RETURN_TO_HAND_ENEMY', 'Gale: Returns a target enemy card to the opponent\'s hand.'),
('Orochi', 'The eight-headed serpent of chaos, consuming everything in its path with relentless hunger.', 'orochi.png', 7, 7, 7, 'epic', FALSE, 'Elemental Sovereigns', 'MULTI_STRIKE_2', 'Multi-strike: Attacks two targets in a single turn.'),
('Rokurokubi', 'By day, she is human. By night, her neck snakes through the fractures to strike from the shadows.', 'rokurokubi.png', 6, 7, 3, 'epic', FALSE, 'Shadow Realm', 'IGNORE_TAUNT', 'Reach: Can attack any enemy card, ignoring Taunt.'),
('Kirin', 'A holy beast that appears only in times of peace to heal the scars of the land.', 'kirin.png', 5, 9, 10, 'epic', FALSE, 'Celestial Court', 'HEAL_AVATAR_FULL', 'Purify: Fully restores your avatar\'s health.'),
-- 🟡 LEGENDARY 
('Ryujin', 'The dragon god of the sea who controls the ebb and flow of all existence.', 'ryujin.png', 7, 8, 8, 'legendary', FALSE, 'Elemental Sovereigns', 'DRAW_2', 'Tide: Draw 2 random cards from your deck.'),
('Izanami', 'The matron of death who rules the underworld, turning loss into a new kind of power.', 'izanami.png', 7, 9, 6, 'legendary', FALSE, 'Shadow Realm', 'RESURRECT_ALLY', 'Necromancy: Resurrects a random friendly card from the graveyard.'),
('Tsukuyomi', 'The moon god whose silver light can freeze time and shroud the world in eternal night.', 'tsukuyomi.png', 6, 10, 12, 'legendary', FALSE, 'Celestial Court', 'SKIP_ENEMY_TURN', 'Eclipse: Opponent skips their next attack phase.'),
('Susanoo', 'The tempestuous god of storms whose sword cuts through even the strongest defenses.', 'susanoo.png', 10, 10, 8, 'legendary', FALSE, 'Elemental Sovereigns', 'DESTROY_2_RANDOM', 'Storm Wrath: Destroys 2 random enemy cards.'),
('Amaterasu', 'The sun goddess who mends the world with golden light, making the broken beautiful once more.', 'amaterasu.png', 9, 10, 9, 'legendary', FALSE, 'Celestial Court', 'HEAL_CLEANSE_ALL_ALLIES', 'Kintsugi: Fully heals and cleanses all friendly cards on the field.')

-- Синхронизация данных: если имя совпало, обновляем все статы
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    avatar_url = VALUES(avatar_url),
    attack = VALUES(attack),
    cost = VALUES(cost),
    defense = VALUES(defense),
    rarity = VALUES(rarity),
    is_basic = VALUES(is_basic),
    clan = VALUES(clan),
    ability_code = VALUES(ability_code),
    ability_description = VALUES(ability_description);