CREATE DATABASE IF NOT EXISTS KIRIdatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE KIRIdatabase;

-- 1. Versions table for shema migrations
CREATE TABLE IF NOT EXISTS schema_version (
    id INT PRIMARY KEY,
    version INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT IGNORE INTO schema_version (id, version) VALUES (1, 1);

CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users table
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
    reset_token_expires DATETIME DEFAULT NULL,
    money INT DEFAULT 0,
    equipped_frame VARCHAR(50) DEFAULT 'frame_default.png',
    music_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    music_volume DECIMAL(3,2) NOT NULL DEFAULT 0.50
);

-- 3. Cards table
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

-- 4. Inventory table
CREATE TABLE IF NOT EXISTS user_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_card (user_id, card_id) 
);

-- 5. Deck table
CREATE TABLE IF NOT EXISTS active_decks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_deck_card (user_id, card_id) 
);

-- 6. Friends table
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

-- 7 Match history table
CREATE TABLE IF NOT EXISTS match_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mode ENUM('ranked', 'casual', 'friend') NOT NULL,
    player1_id INT NOT NULL,
    player2_id INT NOT NULL,
    winner_id INT DEFAULT NULL,
    reason VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_match_player1 (player1_id),
    INDEX idx_match_player2 (player2_id),
    INDEX idx_match_created (created_at)
);

-- 8 Quests table
CREATE TABLE IF NOT EXISTS quests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    quest_type ENUM('daily', 'weekly', 'event', 'achievement') DEFAULT 'daily',
    action_type VARCHAR(50) NOT NULL,
    target_amount INT NOT NULL,
    reward_coins INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_quests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    quest_id INT NOT NULL,
    current_progress INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    is_claimed BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_quest (user_id, quest_id)
);

-- Avatar frames table
CREATE TABLE IF NOT EXISTS shop_frames (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    image_url VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_frame_rotations (
    rotation_date DATE PRIMARY KEY,
    slot1 VARCHAR(50) DEFAULT NULL,
    slot2 VARCHAR(50) DEFAULT NULL,
    slot3 VARCHAR(50) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS user_frames (
    user_id INT NOT NULL,
    frame_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, frame_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (frame_id) REFERENCES shop_frames(id) ON DELETE CASCADE
);

-- Emotes table
CREATE TABLE IF NOT EXISTS emotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    price INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_emotes (
    user_id INT NOT NULL,
    emote_id INT NOT NULL,
    PRIMARY KEY (user_id, emote_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (emote_id) REFERENCES emotes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_emote_decks (
    user_id INT NOT NULL,
    slot_index INT NOT NULL,
    emote_id INT NOT NULL,
    PRIMARY KEY (user_id, slot_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (emote_id) REFERENCES emotes(id) ON DELETE CASCADE
);

INSERT INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) VALUES
-- 🟢 COMMON
('Kodama', 'Tiny forest spirits that dwell in ancient trees. Their presence brings peace to the fractured world.', 'assets/cards/Kodama_Card.png', 1, 1, 2, 'common', TRUE, 'Wild Spirits', 'HEAL_AVATAR', 'Harmony: Restores 1 HP to your avatar at the end of the turn.'),
('Kappa', 'Playful water imps with a hollow in their head. They are as tricky as the rivers they inhabit.', 'assets/cards/Kappa_Card.png', 2, 2, 3, 'common', TRUE, 'Wild Spirits', 'DEBUFF_ATK_1', 'Humidity: Lowers a random enemy\'s attack by 1 when played.'),
('Tanuki', 'Masters of disguise and mischief. They use their magic to blend into the chaos of the memory.', 'assets/cards/Tanuki_Card.png', 2, 2, 2, 'common', TRUE, 'Wild Spirits', 'COPY_WEAK_ATK', 'Mimicry: Copies the attack of a random weak enemy card.'),
('Kitsune', 'Wise foxes with multiple tails. Their illusions are so vivid that even reality itself is fooled.', 'assets/cards/Kitsune_Card.png', 3, 3, 2, 'common', TRUE, 'Wild Spirits', 'IGNORE_FIRST_DMG', 'Illusion: Ignores the first instance of damage received.'),
('Karasu-Tengu', 'Crow-headed warriors who strike like a bolt of lightning from the darkened skies.', 'assets/cards/Karasu-Tengu_Card.png', 4, 3, 1, 'common', TRUE, 'Elemental Sovereigns', 'RUSH', 'Rush: Can attack on the same turn it is played.'),
('Yuki-onna', 'A spirit of the snow who freezes the hearts of those lost in the winter fractures.', 'assets/cards/Yuki-onna_Card.png', 3, 4, 4, 'common', TRUE, 'Shadow Realm', 'FREEZE_TARGET', 'Freeze: Target enemy card cannot attack for 1 turn.'),
('Zashiki-warashi', 'A protective child spirit of the house. While they stay, the home prospers; when they leave, new memories take their place.', 'assets/cards/Zashiki-warashi_Card.png', 3, 4, 3, 'common', TRUE, 'Wild Spirits', 'DEATH_SUMMON_COMMON', 'Legacy: Summons a random Common card upon death.'),
-- 🔵 RARE 
('Komainu', 'Lion-dogs that guard sacred shrines. No fracture can break their unwavering resolve to protect.', 'assets/cards/Komainu_Card.png', 2, 4, 6, 'rare', TRUE, 'Celestial Court', 'TAUNT', 'Taunt: Enemies must attack this card first.'),
('Ronin Ghost', 'A masterless samurai who wanders the void, seeking a purpose in the broken memories.', 'assets/cards/Ronin_Ghost_Card.png', 5, 5, 3, 'rare', TRUE, 'Shadow Realm', 'BUFF_ON_ALLY_DEATH', 'Vengeance: Gains +2 ATK if a friendly card died this turn.'),
('Jorogumo', 'A spider-woman who weaves threads of destiny to trap the unwary and aid her allies.', 'assets/cards/Jorogumo_Card.png', 5, 6, 5, 'rare', TRUE, 'Shadow Realm', 'REDUCE_NEXT_COST', 'Web: Reduces the cost of your next played card by 1.'),
('Inari', 'The deity of prosperity and foxes. Her presence rejuvenates the soil of the soul.', 'assets/cards/Inari_Card.png', 4, 5, 6, 'rare', TRUE, 'Celestial Court', 'BUFF_KITSUNE_ALL', 'Blessing: Grants +1/+1 to all friendly Kitsune cards on the field.'),
('Bake-neko', 'A cat that has lived long enough to gain supernatural powers and toy with death itself.', 'assets/cards/Bake-neko_Card.png', 3, 5, 5, 'rare', TRUE, 'Shadow Realm', 'RETURN_FROM_GRAVE', 'Recall: Returns a random card from the graveyard to your hand.'),
('Tengu Guard', 'Elite protectors of the mountain peaks, using the wind to deflect magical interference.', 'assets/cards/Tengu_Guard_Card.png', 4, 6, 5, 'rare', TRUE, 'Elemental Sovereigns', 'SHIELD_ADJACENT', 'Shield: Protects adjacent cards from enemy abilities.'),
('Namazu', 'A giant catfish whose movements cause the earth to tremble and reality to crack.', 'assets/cards/Namazu_Card.png', 5, 7, 7, 'rare', TRUE, 'Elemental Sovereigns', 'CREATE_RIFT', 'Fracture: Creates a battlefield rift when damaged.'),

('Bake-kujira', 'The skeletal ghost of a whale that brings a haunting song to the shores of the afterlife.', 'assets/cards/Bake-kujira_Card.png', 4, 6, 7, 'epic', FALSE, 'Shadow Realm', 'DEATH_AOE_1', 'Echo: Deals 1 damage to all enemy cards upon death.'),
('Raijin', 'The god of thunder who beats his drums to shake the very foundations of the world.', 'assets/cards/Raijin_Card.png', 6, 6, 4, 'epic', FALSE, 'Elemental Sovereigns', 'DMG_RANDOM_3', 'Discharge: Deals 3 damage to a random enemy card.'),
('Fujin', 'The god of wind who carries the tempests in his bag, ready to blow away any obstacle.', 'assets/cards/Fujin_Card.png', 5, 6, 5, 'epic', FALSE, 'Elemental Sovereigns', 'RETURN_TO_HAND_ENEMY', 'Gale: Returns a target enemy card to the opponent\'s hand.'),
('Orochi', 'The eight-headed serpent of chaos, consuming everything in its path with relentless hunger.', 'assets/cards/Orochi_Card.png', 7, 7, 7, 'epic', FALSE, 'Elemental Sovereigns', 'MULTI_STRIKE_2', 'Multi-strike: Attacks two targets in a single turn.'),
('Rokurokubi', 'By day, she is human. By night, her neck snakes through the fractures to strike from the shadows.', 'assets/cards/Rokurokubi_Card.png', 6, 7, 3, 'epic', FALSE, 'Shadow Realm', 'IGNORE_TAUNT', 'Reach: Can attack any enemy card, ignoring Taunt.'),
('Kirin', 'A holy beast that appears only in times of peace to heal the scars of the land.', 'assets/cards/Kirin_Card.png', 5, 9, 10, 'epic', FALSE, 'Celestial Court', 'HEAL_AVATAR_FULL', 'Purify: Fully restores your avatar\'s health.'),
-- 🟡 LEGENDARY 
('Ryujin', 'The dragon god of the sea who controls the ebb and flow of all existence.', 'assets/cards/Ryujin_Card.png', 7, 8, 8, 'legendary', FALSE, 'Elemental Sovereigns', 'DRAW_2', 'Tide: Draw 2 random cards from your deck.'),
('Izanami', 'The matron of death who rules the underworld, turning loss into a new kind of power.', 'assets/cards/Izanami_Card.png', 7, 9, 6, 'legendary', FALSE, 'Shadow Realm', 'RESURRECT_ALLY', 'Necromancy: Resurrects a random friendly card from the graveyard.'),
('Tsukuyomi', 'The moon god whose silver light can freeze time and shroud the world in eternal night.', 'assets/cards/Tsukuyomi_Card.png', 6, 10, 12, 'legendary', FALSE, 'Celestial Court', 'SKIP_ENEMY_TURN', 'Eclipse: Opponent skips their next attack phase.'),
('Susanoo', 'The tempestuous god of storms whose sword cuts through even the strongest defenses.', 'assets/cards/Susanoo_Card.png', 10, 10, 8, 'legendary', FALSE, 'Elemental Sovereigns', 'DESTROY_2_RANDOM', 'Storm Wrath: Destroys 2 random enemy cards.'),
('Amaterasu', 'The sun goddess who mends the world with golden light, making the broken beautiful once more.', 'assets/cards/Amaterasu_Card.png', 9, 10, 9, 'legendary', FALSE, 'Celestial Court', 'HEAL_CLEANSE_ALL_ALLIES', 'Kintsugi: Fully heals and cleanses all friendly cards on the field.'),
('Izanagi', 'The Great Creator God, whose spear raised the islands from primordial chaos. In the world of KIRI, he is the embodiment of will, summoning reinforcements from the heart of the deepest haze.', 'assets/cards/Izanagi_Card.png', 8, 10, 8, 'legendary', FALSE, 'Celestial Court', 'SUMMON_2_RANDOM_FROM_DECK_MAX_COST_4', 'Primogeniture: When played, summons 2 random friendly cards from your deck (cost 4 or less).'),
('Benzaiten', 'The only goddess among the Seven Lucky Gods, patron of all that flows — water, music, and time. Her melody mends broken souls, much like the golden lacquer of kintsugi.Patron of all that flows — water, music, and time. Her melody guides lost souls, piercing through the eternal mists of KIRI like a beacon of pure light.', 'assets/cards/Benzaiten_Card.png', 5, 9, 11, 'legendary', FALSE, 'Celestial Court', 'HEAL_CLEANSE_ALL_ALLIES', 'Patron of all that flows — water, music, and time. Her melody guides lost souls, piercing through the eternal mists of KIRI like a beacon of pure light.')

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


INSERT INTO quests (id, title, description, quest_type, action_type, target_amount, reward_coins) VALUES
(1, 'First blood', 'Win 1 match', 'daily', 'win_match', 1, 50),
(2, 'Gladiator', 'Play 3 matches', 'daily', 'play_match', 3, 100),
(3, 'Gambler', 'Open 1 omamori pack', 'daily', 'open_pack', 1, 50),

(4, 'Card thrower', 'Play 10 cards', 'weekly', 'play_card', 10, 150),
(5, 'Weekly grind', 'Play 10 matches', 'weekly', 'play_match', 10, 300),
(6, 'Gacha addict', 'Open 5 omamori packs', 'weekly', 'open_pack', 5, 250),

(7, 'Thirst for victory', 'Win 10 matches', 'achievement', 'win_match', 10, 500),
(8, 'Deck master', 'Play 50 cards', 'achievement', 'play_card', 50, 500)

ON DUPLICATE KEY UPDATE 
    title = VALUES(title),
    description = VALUES(description),
    quest_type = VALUES(quest_type),
    action_type = VALUES(action_type),
    target_amount = VALUES(target_amount),
    reward_coins = VALUES(reward_coins);

INSERT INTO shop_frames (id, name, price, image_url) VALUES
('1frame', 'Shadow Ink-Wash Frame', 500, '/assets/avatar_frames/1.png'),
('2frame', 'Imperial Karakusa', 1000, '/assets/avatar_frames/2.png'),
('3frame', 'Gilded Sensu', 1200, '/assets/avatar_frames/3.png'),
('4frame', 'Dark Shoji Lattice', 1400, '/assets/avatar_frames/4.png'),
('5frame', 'Falling Cherry Blossom', 1600, '/assets/avatar_frames/5.png'),
('6frame', 'Samurai Crest', 1800, '/assets/avatar_frames/6.png')

ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    price = VALUES(price),
    image_url = VALUES(image_url);

INSERT INTO emotes (name, file_name, price) VALUES
('Angry', 'emote_angry.png', 750),
('Confused', 'emote_confused.png', 750),
('Cry baby', 'emote_cry_baby.png', 750),
('Flirt', 'emote_flirt.png', 750),
('Sad', 'emote_sad.png', 750),
('Shy', 'emote_shy.png', 750),
('Stair', 'emote_stair.png', 750),
('Tilted', 'emote_tilted.png', 750)

ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    file_name = VALUES(file_name);

CREATE TABLE IF NOT EXISTS lobby_news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    chip VARCHAR(40) DEFAULT 'Update',
    cta_text VARCHAR(80) DEFAULT '',
    cta_target VARCHAR(40) DEFAULT '',
    background_type ENUM('gradient', 'image') NOT NULL DEFAULT 'gradient',
    background_value TEXT NOT NULL,
    clean_banner TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    publish_from DATETIME NULL,
    publish_to DATETIME NULL,
    impressions INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_news_visibility (is_active, status, sort_order),
    INDEX idx_news_dates (publish_from, publish_to)
);

INSERT INTO lobby_news (title, body, chip, cta_text, cta_target, background_type, background_value, clean_banner, status, is_active, sort_order)
SELECT * FROM (
    SELECT 'Season of Ash is Live' AS title,
        'New balance pass, faster queue timings and improved battle emote sync are now active in all modes.' AS body,
        'Update' AS chip,
        'Open Quests' AS cta_text,
        'quests' AS cta_target,
        'gradient' AS background_type,
        'linear-gradient(135deg, rgba(106, 23, 17, 0.75), rgba(16, 18, 25, 0.9)), radial-gradient(circle at 15% 20%, rgba(240, 164, 84, 0.35), transparent 40%)' AS background_value,
        0 AS clean_banner,
        'published' AS status,
        1 AS is_active,
        2 AS sort_order
    UNION ALL
    SELECT 'Challenge Friends Instantly',
        'Right-click a friend to send a duel invite and jump straight into a live PvP match.',
        'Social',
        'View Leaderboard',
        'leaderboard',
        'gradient',
        'linear-gradient(135deg, rgba(35, 53, 28, 0.75), rgba(12, 15, 18, 0.9)), radial-gradient(circle at 20% 15%, rgba(171, 209, 112, 0.3), transparent 40%)',
        0,
        'published',
        1,
        3
    UNION ALL
    SELECT 'DIVINE PRESENCE',
        'Legendary drops are now live. Claim your Omamori.',
        'Divine',
        'GET OMAMORI',
        'gacha',
        'image',
        'assets/gachabaner.png',
        1,
        'published',
        1,
        1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM lobby_news LIMIT 1);