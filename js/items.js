/**
 * items.js - Game items and collectibles
 * Handles item definitions, inventory management, and item functionality
 */

const Items = {
    // Item collections
    items: [], // All available items
    quests: [], // Available quests
    
    // Item type definitions
    rarity: {
        COMMON: { name: "Common", chance: 0.7, color: "#9CA3AF" },
        RARE: { name: "Rare", chance: 0.2, color: "#3B82F6" },
        SUPER_RARE: { name: "Super Rare", chance: 0.08, color: "#8B5CF6" },
        LEGENDARY: { name: "Legendary", chance: 0.02, color: "#F59E0B" }
    },
    
    categories: {
        EQUIPMENT: "equipment",
        CONSUMABLE: "consumable",
        COLLECTIBLE: "collectible",
        KEY_ITEM: "key_item",
        TREASURE: "treasure",
        PET: "pet"
    },
    
    // Initialize items system
    init: function() {
        console.log("[Items] Initializing items system...");
        
        // Define all game items
        this.defineItems();
        
        // Define quests
        this.defineQuests();
        
        console.log(`[Items] Initialized with ${this.items.length} items and ${this.quests.length} quests`);
    },
    
    // Define all game items
    defineItems: function() {
        // Equipment
        this.items.push(
            {
                id: "sword",
                name: "Pixel Sword",
                emoji: "⚔️",
                description: "A basic sword made of pixels.",
                value: 100,
                category: this.categories.EQUIPMENT,
                slot: "weapon",
                stats: { attack: 10 }
            },
            {
                id: "shield",
                name: "Nostr Shield",
                emoji: "🛡️",
                description: "A shield with the Nostr logo.",
                value: 80,
                category: this.categories.EQUIPMENT,
                slot: "offhand",
                stats: { defense: 8 }
            },
            {
                id: "helmet",
                name: "Miner's Helmet",
                emoji: "⛑️",
                description: "A helmet for mining bitcoin.",
                value: 60,
                category: this.categories.EQUIPMENT,
                slot: "head",
                stats: { defense: 5, mining: 3 }
            },
            {
                id: "boots",
                name: "Lightning Boots",
                emoji: "👢",
                description: "Boots that increase movement speed.",
                value: 75,
                category: this.categories.EQUIPMENT,
                slot: "feet",
                stats: { speed: 15 }
            },
            {
                id: "wand",
                name: "ZapWand",
                emoji: "🪄",
                description: "A wand that channels lightning energy.",
                value: 120,
                category: this.categories.EQUIPMENT,
                slot: "weapon",
                stats: { lightning: 12 }
            }
        );
        
        // Consumables
        this.items.push(
            {
                id: "potion",
                name: "Health Potion",
                emoji: "🧪",
                description: "Restores 50 health points.",
                value: 30,
                category: this.categories.CONSUMABLE,
                use: function(player) {
                    player.health += 50;
                    if (player.health > player.maxHealth) player.health = player.maxHealth;
                    return `Restored 50 health. Current health: ${player.health}`;
                }
            },
            {
                id: "scroll",
                name: "Scroll of Speed",
                emoji: "📜",
                description: "Temporarily increases movement speed.",
                value: 45,
                category: this.categories.CONSUMABLE,
                use: function(player) {
                    player.buffs.push({
                        id: "speed_boost",
                        stat: "speed",
                        value: 30,
                        duration: 60 * 1000, // 60 seconds
                        startTime: Date.now()
                    });
                    return "Movement speed increased for 60 seconds!";
                }
            },
            {
                id: "apple",
                name: "Golden Apple",
                emoji: "🍎",
                description: "Gives 100 experience points.",
                value: 50,
                category: this.categories.CONSUMABLE,
                use: function(player) {
                    player.experience += 100;
                    player.checkLevelUp();
                    return `Gained 100 experience points!`;
                }
            }
        );
        
        // Collectibles
        this.items.push(
            {
                id: "gem",
                name: "Lightning Gem",
                emoji: "💎",
                description: "A valuable gem charged with lightning energy.",
                value: 150,
                category: this.categories.COLLECTIBLE
            },
            {
                id: "gold",
                name: "Gold Coin",
                emoji: "💰",
                description: "Standard currency of the Relay World.",
                value: 10,
                category: this.categories.COLLECTIBLE
            },
            {
                id: "ring",
                name: "Relay Ring",
                emoji: "💍",
                description: "A ring that connects to the Nostr network.",
                value: 80,
                category: this.categories.COLLECTIBLE
            },
            {
                id: "key",
                name: "Private Key",
                emoji: "🔑",
                description: "Unlocks a special chest somewhere in the world.",
                value: 75,
                category: this.categories.KEY_ITEM
            },
            {
                id: "crown",
                name: "Event Crown",
                emoji: "👑",
                description: "Only found during special events.",
                value: 500,
                category: this.categories.COLLECTIBLE
            }
        );
        
        // Pets
        this.items.push(
            {
                id: "pet_cat",
                name: "Pixelated Cat",
                emoji: "🐱",
                description: "A digital cat that follows you around.",
                value: 250,
                category: this.categories.PET,
                stats: { luck: 5 }
            },
            {
                id: "pet_dog",
                name: "Relay Dog",
                emoji: "🐶",
                description: "A loyal digital dog that finds hidden items.",
                value: 300,
                category: this.categories.PET,
                stats: { find: 7 }
            },
            {
                id: "pet_dragon",
                name: "Lightning Dragon",
                emoji: "🐉",
                description: "A rare dragon pet that enhances zap powers.",
                value: 1000,
                category: this.categories.PET,
                stats: { lightning: 10, attack: 15 }
            }
        );
    },
    
    // Define quests
    defineQuests: function() {
        this.quests = [
            {
                id: "collect_gems",
                name: "Gem Collector",
                description: "Collect 5 Lightning Gems from around the world.",
                type: "collect",
                target: 5,
                targetItem: "gem",
                reward: 500
            },
            {
                id: "explore_world",
                name: "World Explorer",
                description: "Travel 10,000 units across the Relay World.",
                type: "explore",
                target: 10000,
                reward: 750
            },
            {
                id: "social_butterfly",
                name: "Social Butterfly",
                description: "Interact with 10 different players.",
                type: "interact",
                target: 10,
                reward: 600
            },
            {
                id: "chat_master",
                name: "Chat Master",
                description: "Send 20 chat messages to other players.",
                type: "chat",
                target: 20,
                reward: 400
            },
            {
                id: "follow_friends",
                name: "Friend Collector",
                description: "Follow 5 other players.",
                type: "follow",
                target: 5,
                reward: 300
            },
            {
                id: "high_scorer",
                name: "High Scorer",
                description: "Reach a score of 5000 points.",
                type: "score",
                target: 5000,
                reward: 1000
            }
        ];
    },
    
    // Get a random item
    getRandomItem: function() {
        // First determine rarity
        const rarityRoll = Math.random();
        let selectedRarity = "COMMON";
        let cumulativeChance = 0;
        
        for (const rarity in this.rarity) {
            cumulativeChance += this.rarity[rarity].chance;
            if (rarityRoll < cumulativeChance) {
                selectedRarity = rarity;
                break;
            }
        }
        
        // Filter items by rarity
        const possibleItems = this.items.filter(item => 
            item.category !== this.categories.KEY_ITEM && 
            item.category !== this.categories.PET
        );
        
        // Select a random item
        const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];
        
        // Clone the item and add rarity
        return {
            ...item,
            id: `${item.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            rarity: selectedRarity
        };
    },
    
    // Get items by rarity
    getByRarity: function(rarity) {
        return this.items.filter(item => 
            item.category !== this.categories.KEY_ITEM && 
            item.category !== this.categories.PET
        );
    },
    
    // Get items by category
    getByCategory: function(category) {
        return this.items.filter(item => item.category === category);
    },
    
    // Use an item from inventory
    useItem: function(itemId) {
        // Find item in player's inventory
        const itemIndex = Player.inventory.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return { success: false, message: "Item not found in inventory." };
        }
        
        const item = Player.inventory[itemIndex];
        
        // Check if item is usable
        if (item.category !== this.categories.CONSUMABLE || !item.use) {
            return { success: false, message: "This item cannot be used." };
        }
        
        // Use the item
        const message = item.use(Player);
        
        // Remove from inventory if consumed
        Player.inventory.splice(itemIndex, 1);
        
        return { success: true, message };
    },
    
    // Equip an item
    equipItem: function(itemId) {
        // Find item in player's inventory
        const itemIndex = Player.inventory.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return { success: false, message: "Item not found in inventory." };
        }
        
        const item = Player.inventory[itemIndex];
        
        // Check if item is equipment
        if (item.category !== this.categories.EQUIPMENT || !item.slot) {
            return { success: false, message: "This item cannot be equipped." };
        }
        
        // Unequip any item in the same slot
        if (Player.equipment[item.slot]) {
            // Return current equipment to inventory
            Player.inventory.push(Player.equipment[item.slot]);
        }
        
        // Equip new item
        Player.equipment[item.slot] = item;
        
        // Remove from inventory
        Player.inventory.splice(itemIndex, 1);
        
        // Update player stats
        Player.updateStats();
        
        return { success: true, message: `Equipped ${item.name}!` };
    },
    
    // Unequip an item
    unequipItem: function(slot) {
        // Check if anything is equipped in this slot
        if (!Player.equipment[slot]) {
            return { success: false, message: "Nothing equipped in this slot." };
        }
        
        // Add equipped item back to inventory
        Player.inventory.push(Player.equipment[slot]);
        
        // Clear the slot
        Player.equipment[slot] = null;
        
        // Update player stats
        Player.updateStats();
        
        return { success: true, message: "Item unequipped!" };
    },
    
    // Equip a pet
    equipPet: function(itemId) {
        // Find item in player's inventory
        const itemIndex = Player.inventory.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return { success: false, message: "Pet not found in inventory." };
        }
        
        const item = Player.inventory[itemIndex];
        
        // Check if item is a pet
        if (item.category !== this.categories.PET) {
            return { success: false, message: "This item is not a pet." };
        }
        
        // Unequip current pet if any
        if (Player.pet) {
            // Return current pet to inventory
            Player.inventory.push(Player.pet);
        }
        
        // Equip new pet
        Player.pet = item;
        
        // Remove from inventory
        Player.inventory.splice(itemIndex, 1);
        
        // Update player stats
        Player.updateStats();
        
        return { success: true, message: `${item.name} is now following you!` };
    },
    
    // Get item details by ID template (not instance ID)
    getItemById: function(templateId) {
        return this.items.find(item => item.id === templateId);
    },
    
    // Get quest by ID
    getQuestById: function(questId) {
        return this.quests.find(quest => quest.id === questId);
    }
};

// Export Items as the default export
export default Items;
