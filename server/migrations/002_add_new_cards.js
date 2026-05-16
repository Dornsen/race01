module.exports = {
    name: '002_add_kodama_card',
    up: async (db) => {
        try {
            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Oni Blacksmith', 'A red-skinned horned demon working tirelessly at his anvil. His heavy iron hammers forge weapons strong enough to pierce through the thickest haze..', 
                'assets/cards/Oni_Blacksmith_Card.png', 1, 2, 3, 'common', TRUE, 'Elemental Sovereigns', 'ATK_BUFF', 
                'Sharpen — When played, grants +1 ATK to an adjacent ally card.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Nekomata', 'A twin-tailed cat spirit known for its supernatural speed and playful malice. It dances on the edge of vision, vanishing before a blade can strike.', 
                'assets/cards/Nekomata_Card.png', 2, 2, 2, 'common', TRUE, 'Wild Spirits', 'DODGE', 
                'Agility — Has a 50% chance to completely dodge the first attack directed at it.')
            `);
            
            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Kamaitachi', 'The legendary sickle-weasel that rides on fierce gusts of wind. Moving faster than the eye can see, it inflicts sharp wounds before its victims even feel the breeze.', 
                'assets/cards/Kamaitachi_Card.png', 3, 2, 1, 'common', TRUE, 'Wild Spirits', 'RANDOM_ATK', 
                'Slicing Wind — Deals 1 damage to a random enemy card when played.')
            `);
            
            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Nurikabe', 'A massive, sentient wall yokai that manifests out of nowhere to block travelers. An immovable fortress that shields its allies from impending harm.', 
                'assets/cards/Nurikabe_Card.png', 0, 3, 6, 'rare', TRUE, 'Elemental Sovereigns', 'BLOCK', 
                'Stone Wall — Taunt (Enemies must attack this card first). This card cannot attack.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Undead Samurai', 'A ghostly warrior clad in ancient, weathered armor. Bound by a blood oath that outlasted death, his spirit refuses to fall without taking his foe down with him.', 
                'assets/cards/Undead_Samurai_Card.png', 3, 3, 2, 'rare', TRUE, 'Shadow Realm', 'RETURN_DMG', 
                'Vengeance — Deals 2 damage to the attacker when this card is destroyed.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Sohei Monk', 'A warrior monk wielding a long naginata spear. Through sacred mantras and iron discipline, his presence brings spiritual healing to his allies', 
                'assets/cards/Sohei_Monk_Card.png', 4, 2, 4, 'rare', TRUE, 'Celestial Court', 'HEAL', 
                'Meditation — Restores 1 HP to your Avatar at the start of your turn.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Gashadokuro', 'A giant skeletal apparition formed from the bones of fallen soldiers. It wanders the battlefield under the cover of night, growing stronger by consuming wandering souls.', 
                'assets/cards/Gashadokuro_Card.png', 4, 5, 5, 'epic', FALSE, 'Shadow Realm', 'BLOCK', 
                'Soul Feast — Gains +1 ATK and +1 DEF whenever any other card on the field dies.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Onryo', 'A vengeful wrathful spirit of a woman in a white kimono, her face hidden behind long black hair. Her icy gaze fills the hearts of enemies with overwhelming dread.', 
                'assets/cards/Onryo_Card.png', 3, 5, 3, 'epic', FALSE, 'Shadow Realm', 'CURSE', 
                'Curse — When played, reduces the ATK of all current enemy cards on the field by 1.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Shadow Shinobi', 'An elite assassin who treats the thick fog as his closest ally. He strikes from the shadows, bypassing defensive lines before disappearing into thin air.', 
                'assets/cards/Shadow_Shinobi_Card.png', 4, 4, 2, 'epic', FALSE, 'Shadow Realm', 'AMBUSH', 
                'Ambush — Attacks immediately when played, ignoring any enemy Taunt cards.')
            `);

            await db.query(`
                INSERT IGNORE INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                VALUES ('Kaguya-hime', 'The tragic and ethereal Princess of the Moon, fallen into the shifting depths of KIRI. Her otherworldly beauty is as captivating as it is lethal, and her cold lunar blades cut down anyone who dares step into her endless night.', 
                'assets/cards/Kaguya_hime_Card.png', 6, 7, 6, 'legendary', FALSE, 'Celestial Court', 'LUNAR_EXECUTION', 
                'Lunar Execution — When played, targets the strongest enemy card on the field. Deals damage to it equal to its own Attack value.')
            `);
            
            const [result] = await db.query(`
                INSERT IGNORE INTO user_cards (user_id, card_id)
                SELECT users.id, cards.id 
                FROM users 
                JOIN cards ON cards.is_basic = TRUE;
            `);

            console.log("🔹 [Migration 002] New Cards has been verified/added to the database.");
        } catch (err) {
            console.error("❌ [Migration 002] Error adding cards:", err.message);
            throw err;
        }
    }
};