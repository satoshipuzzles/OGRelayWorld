/**
 * ui.js - User Interface management
 * Handles UI interactions, updates, and display
 */

const UI = {
    audioContext: null,
    sounds: {},
    loadedSounds: 0,
    totalSounds: 0,
    
    init: function() {
        console.log("[UI] Initializing UI...");
        this.loadSoundsSimple();
        this.setupEventListeners();
        console.log("[UI] UI initialized");
    },
    
    loadSoundsSimple: function() {
        console.log("[UI] Initializing simple audio system...");
        
        // Define sounds to load - commented out to avoid warnings
        const soundsToLoad = {
            // 'item': 'assets/sounds/item.mp3',
            // 'chat': 'assets/sounds/chat.mp3',
            // 'success': 'assets/sounds/success.mp3',
            // 'error': 'assets/sounds/error.mp3',
            // 'portal': 'assets/sounds/portal.mp3',
            // 'treasure': 'assets/sounds/treasure.mp3',
            // 'zap': 'assets/sounds/zap.mp3',
            // 'levelup': 'assets/sounds/levelup.mp3',
            // 'death': 'assets/sounds/death.mp3',
            // 'login': 'assets/sounds/login.mp3'
        };
        
        this.sounds = {};
        
        for (const [name, url] of Object.entries(soundsToLoad)) {
            try {
                const audio = document.createElement('audio');
                audio.src = url;
                audio.preload = 'auto';
                this.sounds[name] = audio;
                console.log(`[UI] Sound '${name}' loaded successfully`);
            } catch (error) {
                console.error(`[UI] Failed to load sound "${name}":`, error);
            }
        }
        
        console.log('[UI] Simple sound system initialized');
    },
    
    initAudio: function() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const soundsToLoad = {
                // 'item': 'assets/sounds/item.mp3',
                // 'chat': 'assets/sounds/chat.mp3',
                // 'success': 'assets/sounds/success.mp3',
                // 'error': 'assets/sounds/error.mp3',
                // 'portal': 'assets/sounds/portal.mp3',
                // 'treasure': 'assets/sounds/treasure.mp3',
                // 'zap': 'assets/sounds/zap.mp3',
                // 'levelup': 'assets/sounds/levelup.mp3',
                // 'death': 'assets/sounds/death.mp3',
                // 'login': 'assets/sounds/login.mp3'
            };
            this.totalSounds = Object.keys(soundsToLoad).length;
            for (const [name, url] of Object.entries(soundsToLoad)) this.loadSound(name, url);
            console.log("[UI] Audio system initialized");
        } catch (error) {
            console.error("[UI] Failed to initialize audio:", error);
        }
    },
    
    loadSound: function(name, url) {
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(buffer => this.audioContext.decodeAudioData(buffer))
            .then(decodedData => {
                this.sounds[name] = decodedData;
                this.loadedSounds++;
                if (this.loadedSounds === this.totalSounds) console.log("[UI] All sounds loaded successfully");
            })
            .catch(error => console.error(`[UI] Failed to load sound "${name}":`, error));
    },
    
    playSound: function(name) {
        if (!this.sounds[name]) {
            console.warn(`[UI] Sound "${name}" not found`);
            return;
        }
        try {
            const soundClone = this.sounds[name].cloneNode();
            soundClone.volume = 0.5;
            soundClone.play().catch(e => console.warn(`[UI] Failed to play sound: ${e.message}`));
        } catch (error) {
            console.error(`[UI] Failed to play sound "${name}":`, error);
        }
    },
    
    playSound_original: function(name) {
        if (!this.sounds[name]) {
            console.warn(`[UI] Sound "${name}" not found`);
            return;
        }
        try {
            if (this.audioContext.state === 'suspended') this.audioContext.resume();
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.5;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start(0);
        } catch (error) {
            console.error(`[UI] Failed to play sound "${name}":`, error);
        }
    },
    
    setupEventListeners: function() {
        document.getElementById('inventory-button').addEventListener('click', this.toggleInventory.bind(this));
        document.getElementById('inventory-close').addEventListener('click', this.toggleInventory.bind(this));
        
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
            chatInput.addEventListener('focus', () => {
                if (typeof Player !== 'undefined') {
                    Player._inputState = { ...Player.input };
                    Player.input.up = false;
                    Player.input.down = false;
                    Player.input.left = false;
                    Player.input.right = false;
                    Player.chatFocused = true;
                }
            });
            chatInput.addEventListener('blur', () => {
                if (typeof Player !== 'undefined') Player.chatFocused = false;
            });
        }
        
        document.getElementById('send-chat-button').addEventListener('click', this.sendChatMessage.bind(this));
        document.getElementById('user-popup-close').addEventListener('click', this.hideUserPopup.bind(this));
        document.getElementById('follow-button').addEventListener('click', this.toggleFollowUser.bind(this));
        document.getElementById('chat-button').addEventListener('click', this.openDirectChat.bind(this));
        document.getElementById('voice-chat-button').addEventListener('click', this.toggleVoiceChat.bind(this));
        document.getElementById('trade-button').addEventListener('click', this.initiateTrade.bind(this));
        document.getElementById('zap-button').addEventListener('click', this.initiateZap.bind(this));
        
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab || e.target.dataset.type;
                if (tab) this.switchTab(tab, e.target.closest('.tab-container'));
            });
        });
        
        document.getElementById('relay-selector').addEventListener('change', (e) => {
            const relayUrl = e.target.value;
            if (typeof Nostr !== 'undefined' && typeof Nostr.setActiveExplorerRelay === 'function') {
                Nostr.setActiveExplorerRelay(relayUrl);
            }
        });
        
        document.getElementById('add-relay-button').addEventListener('click', this.addCustomRelay.bind(this));
        document.getElementById('add-kind-button').addEventListener('click', this.addCustomKind.bind(this));
        
        // Add relay info button event listener
        const relayInfoButton = document.getElementById('relay-info-button');
        if (relayInfoButton) {
            relayInfoButton.addEventListener('click', this.showRelayInfo.bind(this));
        }
        
        document.getElementById('guild-button').addEventListener('click', () => this.showFeatureNotice('Guild'));
        document.getElementById('shop-button').addEventListener('click', () => this.showFeatureNotice('Shop'));
        document.getElementById('pet-button').addEventListener('click', () => this.showFeatureNotice('Pet'));
        document.getElementById('faction-button').addEventListener('click', () => this.showFeatureNotice('Faction'));
        document.getElementById('dungeon-button').addEventListener('click', () => this.showFeatureNotice('Dungeon'));
        document.getElementById('stash-button').addEventListener('click', () => this.showFeatureNotice('Stash'));
    },
    
    setLoginStatus: function(message) {
        const statusElement = document.getElementById('login-status');
        if (statusElement) statusElement.textContent = message;
    },
    
    hideLoginScreen: function() {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.opacity = 0;
            setTimeout(() => {
                loginScreen.style.display = 'none';
                document.getElementById('top-bar').classList.remove('hide');
                document.getElementById('player-profile').classList.remove('hide');
                document.getElementById('leaderboard-container').classList.remove('hide');
                document.getElementById('chat-container').classList.remove('hide');
                document.getElementById('mini-map').classList.remove('hide');
                if (window.innerWidth <= 768) document.getElementById('mobile-controls').classList.remove('hide');
            }, 500);
        }
    },
    
    playLoginSound: function() {
        this.playSound('login');
        const soundWave = document.getElementById('sound-wave');
        soundWave.style.animation = 'sound-wave 2s ease-out';
        setTimeout(() => soundWave.style.animation = 'none', 2000);
    },
    
    showToast: function(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        if (type === 'success' && this.playSound) this.playSound('success');
        else if (type === 'error' && this.playSound) this.playSound('error');
        setTimeout(() => toast.remove(), 3000);
    },
    
    updatePlayerProfile: function() {
        document.getElementById('player-profile-image').src = Player.profile?.picture || 'assets/icons/default-avatar.png';
        document.getElementById('player-profile-name').textContent = Player.profile?.name || Utils.formatPubkey(Player.pubkey, { short: true });
        document.getElementById('player-profile-npub').textContent = Utils.formatPubkey(Player.pubkey, { short: true, useNpub: true });
        document.getElementById('profile-level').textContent = Player.level;
        document.getElementById('profile-score').textContent = Utils.formatNumber(Player.score);
        document.getElementById('profile-items').textContent = Player.inventory.length;
        document.getElementById('profile-interactions').textContent = Player.interactions;
        document.getElementById('profile-zaps').textContent = Player.zapsSent + Player.zapsReceived;
        document.getElementById('score-display').textContent = `Score: ${Utils.formatNumber(Player.score)}`;
    },
    
    // Update relay selector to show relay types
    updateRelaySelector: function() {
        const selector = document.getElementById('relay-selector');
        selector.innerHTML = '';
        
        if (typeof RelayWorld === 'undefined' || !RelayWorld.config || 
            typeof Nostr === 'undefined' || !Nostr.explorerRelays) {
            return;
        }
        
        // Add header group for game relay
        const gameGroup = document.createElement('optgroup');
        gameGroup.label = "Game Relay (Locked)";
        
        const gameOption = document.createElement('option');
        gameOption.value = RelayWorld.config.GAME_RELAY;
        gameOption.textContent = RelayWorld.config.GAME_RELAY.replace('wss://', '');
        gameOption.disabled = true;
        gameGroup.appendChild(gameOption);
        selector.appendChild(gameGroup);
        
        // Add header for login relay
        const loginGroup = document.createElement('optgroup');
        loginGroup.label = "Login Relay (Default)";
        
        const loginOption = document.createElement('option');
        loginOption.value = RelayWorld.config.LOGIN_RELAY;
        loginOption.textContent = RelayWorld.config.LOGIN_RELAY.replace('wss://', '');
        loginOption.disabled = true;
        loginGroup.appendChild(loginOption);
        selector.appendChild(loginGroup);
        
        // Add explorer relays group
        const explorerGroup = document.createElement('optgroup');
        explorerGroup.label = "Explorer Relays";
        
        for (const [relayUrl] of Nostr.explorerRelays) {
            // Skip game and login relays in this section
            if (relayUrl === RelayWorld.config.GAME_RELAY || 
                relayUrl === RelayWorld.config.LOGIN_RELAY) continue;
                
            const option = document.createElement('option');
            option.value = relayUrl;
            option.textContent = relayUrl.replace('wss://', '');
            option.selected = relayUrl === Nostr.activeExplorerRelay;
            explorerGroup.appendChild(option);
        }
        selector.appendChild(explorerGroup);
    },
    
    // Update addCustomRelay to connect to explorer relays
    addCustomRelay: function() {
        const input = document.getElementById('custom-relay-input');
        let relayUrl = input.value.trim();
        if (!relayUrl) {
            this.showToast("Please enter a relay URL", "error");
            return;
        }
        
        if (!relayUrl.startsWith('wss://')) relayUrl = `wss://${relayUrl}`;
        
        // Don't allow changing game relay
        if (relayUrl === RelayWorld.config.GAME_RELAY) {
            this.showToast("Cannot modify the game relay", "error");
            return;
        }
        
        // Don't allow changing login relay
        if (relayUrl === RelayWorld.config.LOGIN_RELAY) {
            this.showToast("Cannot modify the login relay", "error");
            return;
        }
        
        if (typeof Nostr !== 'undefined' && typeof Nostr.connectToExplorerRelay === 'function') {
            Nostr.connectToExplorerRelay(relayUrl)
                .then(() => {
                    this.showToast(`Connected to explorer relay: ${relayUrl}`, "success");
                    this.updateRelaySelector();
                    input.value = '';
                })
                .catch(error => this.showToast(`Failed to connect to relay: ${error.message}`, "error"));
        } else {
            this.showToast("Nostr module not fully initialized", "error");
        }
    },
    
    addCustomKind: function() {
        const input = document.getElementById('custom-kind-input');
        const kindStr = input.value.trim();
        if (!kindStr) {
            this.showToast("Please enter an event kind", "error");
            return;
        }
        const kind = parseInt(kindStr);
        if (isNaN(kind) || kind < 0) {
            this.showToast("Event kind must be a positive integer", "error");
            return;
        }
        if (Game && Game.subscribedKinds && typeof Game.subscribedKinds.add === 'function') {
            Game.subscribedKinds.add(kind);
            this.updateKindsSelector();
            input.value = '';
            this.showToast(`Added event kind ${kind} to subscription`, "success");
        } else {
            this.showToast("Game system not fully initialized", "error");
        }
    },
    
    updateKindsSelector: function() {
        const selector = document.getElementById('kinds-selector');
        selector.innerHTML = '';
        
        // Add Game event kinds group
        const gameKindsGroup = document.createElement('optgroup');
        gameKindsGroup.label = "Game Event Kinds";
        
        if (typeof RelayWorld !== 'undefined' && RelayWorld.config && RelayWorld.config.EVENT_KINDS) {
            const kinds = RelayWorld.config.EVENT_KINDS;
            
            for (const [name, kind] of Object.entries(kinds)) {
                const option = document.createElement('option');
                option.value = kind;
                option.textContent = `${kind} (${name.toLowerCase()})`;
                option.disabled = true; // Game kinds are locked
                gameKindsGroup.appendChild(option);
            }
            selector.appendChild(gameKindsGroup);
        }
        
        // Add Explorer event kinds group
        const explorerKindsGroup = document.createElement('optgroup');
        explorerKindsGroup.label = "Explorer Event Kinds";
        
        if (typeof RelayWorld !== 'undefined' && RelayWorld.config && RelayWorld.config.EXPLORER_KINDS) {
            const kinds = RelayWorld.config.EXPLORER_KINDS;
            
            for (const kind of kinds) {
                const option = document.createElement('option');
                option.value = kind;
                option.textContent = `Kind ${kind}`;
                
                // Add description for known kinds
                switch (kind) {
                    case 0: option.textContent += " (Metadata)"; break;
                    case 1: option.textContent += " (Text Note)"; break;
                    case 3: option.textContent += " (Contacts)"; break;
                    case 4: option.textContent += " (Direct Message)"; break;
                    case 9: option.textContent += " (Chat)"; break;
                    case 30023: option.textContent += " (Long-form Content)"; break;
                }
                
                explorerKindsGroup.appendChild(option);
            }
            selector.appendChild(explorerKindsGroup);
        }
        
        // Add custom kinds group
        if (Game && Game.subscribedGameKinds) {
            const customKindsGroup = document.createElement('optgroup');
            customKindsGroup.label = "Custom Event Kinds";
            
            for (const kind of Game.subscribedGameKinds) {
                // Skip if it's already in one of the standard groups
                if (
                    (RelayWorld.config.EVENT_KINDS && Object.values(RelayWorld.config.EVENT_KINDS).includes(kind)) ||
                    (RelayWorld.config.EXPLORER_KINDS && RelayWorld.config.EXPLORER_KINDS.includes(kind))
                ) {
                    continue;
                }
                
                const option = document.createElement('option');
                option.value = kind;
                option.textContent = `Kind ${kind} (Custom)`;
                customKindsGroup.appendChild(option);
            }
            
            if (customKindsGroup.children.length > 0) {
                selector.appendChild(customKindsGroup);
            }
        }
    },
    
    // Show relay info in the UI
    showRelayInfo: function() {
        if (typeof RelayWorld === 'undefined' || !RelayWorld.config) return;
        
        const content = `
            <h3>Relay Configuration</h3>
            <div class="relay-info">
                <div class="relay-group">
                    <h4>Game Relay</h4>
                    <p>${RelayWorld.config.GAME_RELAY}</p>
                    <small>All game events and player positions</small>
                </div>
                <div class="relay-group">
                    <h4>Login Relay</h4>
                    <p>${RelayWorld.config.LOGIN_RELAY}</p>
                    <small>Default login and explorer relay</small>
                </div>
                <div class="relay-group">
                    <h4>Active Explorer</h4>
                    <p>${Nostr?.activeExplorerRelay || "None selected"}</p>
                    <small>Current explorer relay providing content</small>
                </div>
            </div>
        `;
        
        // Create modal to display info
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                ${content}
                <button id="close-relay-info" class="pixel-button">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add close button handler
        document.getElementById('close-relay-info').addEventListener('click', () => {
            modal.remove();
        });
    },
    
    sendChatMessage: function() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;
        if (Nostr.publishChatMessage(message)) {
            const username = Player.profile?.name || Utils.formatPubkey(Player.pubkey, { short: true });
            this.addChatMessage(username, message, true);
            input.value = '';
            Player.chatMessages++;
            this.playSound('chat');
        }
    },
    
    addChatMessage: function(username, message, isFromMe = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${isFromMe ? 'from-me' : ''}`;
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = username;
        messageElement.appendChild(usernameSpan);
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = ` [${new Date().toLocaleTimeString()}] `;
        messageElement.appendChild(timestampSpan);
        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        contentSpan.textContent = message;
        messageElement.appendChild(contentSpan);
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },
    
    showUserPopup: function(pubkey) {
        const user = Nostr.getUser(pubkey);
        if (!user) return;
        const popup = document.getElementById('user-popup');
        popup.dataset.pubkey = pubkey;
        document.getElementById('user-popup-image').src = user.profile?.picture || 'assets/icons/default-avatar.png';
        document.getElementById('user-popup-name').textContent = user.profile?.name || Utils.formatPubkey(pubkey, { short: true });
        document.getElementById('user-popup-npub').textContent = Utils.formatPubkey(pubkey, { short: true, useNpub: true });
        document.getElementById('user-level').textContent = user.level || '1';
        document.getElementById('user-score').textContent = Utils.formatNumber(user.score || 0);
        document.getElementById('user-guild').textContent = user.guild || 'None';
        document.getElementById('user-faction').textContent = user.faction || 'None';
        
        // Add NPC indicator if applicable
        const userTitle = document.getElementById('user-popup-name');
        if (user.isNPC) {
            userTitle.textContent += ' [NPC]';
            userTitle.className = 'npc-user';
        } else {
            userTitle.className = '';
        }
        
        this.updateFollowButton(pubkey);
        this.updateUserNotes(pubkey);
        popup.classList.remove('hide');
    },
    
    hideUserPopup: function() {
        document.getElementById('user-popup').classList.add('hide');
    },
    
    updateFollowButton: function(pubkey) {
        const followButton = document.getElementById('follow-button');
        const isFollowing = Nostr.isFollowing(pubkey);
        followButton.textContent = isFollowing ? 'Unfollow' : 'Follow';
        followButton.className = isFollowing ? 'user-popup-button following' : 'user-popup-button';
    },
    
    toggleFollowUser: function() {
        const popup = document.getElementById('user-popup');
        const pubkey = popup.dataset.pubkey;
        if (!pubkey) return;
        const isFollowing = Nostr.isFollowing(pubkey);
        if (isFollowing) {
            Nostr.unfollowUser(pubkey)
                .then(() => {
                    this.updateFollowButton(pubkey);
                    this.showToast(`Unfollowed ${Nostr.getUser(pubkey)?.profile?.name || Utils.formatPubkey(pubkey, { short: true })}`, "info");
                })
                .catch(error => this.showToast(`Failed to unfollow: ${error.message}`, "error"));
        } else {
            Nostr.followUser(pubkey)
                .then(() => {
                    this.updateFollowButton(pubkey);
                    this.showToast(`Following ${Nostr.getUser(pubkey)?.profile?.name || Utils.formatPubkey(pubkey, { short: true })}`, "success");
                    Player.follows++;
                    Player.interactions++;
                    Player.score += 50;
                    Nostr.publishPlayerStats();
                    this.updatePlayerProfile();
                })
                .catch(error => this.showToast(`Failed to follow: ${error.message}`, "error"));
        }
    },
    
    updateUserNotes: function(pubkey) {
        const user = Nostr.getUser(pubkey);
        if (!user) return;
        const notesContainer = document.getElementById('user-notes');
        notesContainer.innerHTML = '';
        if (!user.notes || user.notes.length === 0) {
            notesContainer.innerHTML = '<div class="no-notes">No recent notes found</div>';
            return;
        }
        for (let i = 0; i < Math.min(user.notes.length, 5); i++) {
            const note = user.notes[i];
            const noteElement = document.createElement('div');
            noteElement.className = 'user-note';
            const contentElement = document.createElement('div');
            contentElement.className = 'user-note-content';
            contentElement.textContent = note.content;
            noteElement.appendChild(contentElement);
            const timestampElement = document.createElement('div');
            timestampElement.className = 'user-note-timestamp';
            timestampElement.textContent = Utils.formatDate(note.created_at);
            noteElement.appendChild(timestampElement);
            notesContainer.appendChild(noteElement);
        }
    },
    
    openDirectChat: function() {
        this.showFeatureNotice('Direct Chat');
    },
    
    toggleVoiceChat: function() {
        if (Audio.isVoiceChatActive) {
            Audio.stopVoiceChat();
            this.showToast("Voice chat disabled", "info");
        } else {
            Audio.startVoiceChat()
                .then(success => {
                    if (success) this.showToast("Voice chat activated - nearby players can hear you", "success");
                })
                .catch(error => this.showToast(`Failed to start voice chat: ${error.message}`, "error"));
        }
    },
    
    initiateTrade: function() {
        this.showFeatureNotice('Trading');
    },
    
    initiateZap: function() {
        const popup = document.getElementById('user-popup');
        const pubkey = popup.dataset.pubkey;
        if (!pubkey) return;
        Zaps.showZapInterface(pubkey);
    },
    
    toggleInventory: function() {
        const inventory = document.getElementById('inventory-interface');
        if (inventory.classList.contains('hide')) {
            this.updateInventoryUI();
            inventory.classList.remove('hide');
        } else {
            inventory.classList.add('hide');
        }
    },
    
    updateInventoryUI: function() {
        const container = document.getElementById('inventory-content');
        container.innerHTML = '';
        if (Player.inventory.length === 0) {
            container.innerHTML = '<div class="empty-inventory">Your inventory is empty</div>';
            return;
        }
        for (const item of Player.inventory) {
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            itemElement.dataset.id = item.id;
            const iconElement = document.createElement('div');
            iconElement.className = 'inventory-item-icon';
            iconElement.textContent = item.emoji;
            itemElement.appendChild(iconElement);
            const nameElement = document.createElement('div');
            nameElement.className = 'inventory-item-name';
            nameElement.textContent = item.name;
            itemElement.appendChild(nameElement);
            if (item.rarity) {
                const rarityElement = document.createElement('div');
                rarityElement.className = `inventory-item-rarity rarity-${item.rarity.toLowerCase()}`;
                rarityElement.textContent = Items.rarity[item.rarity].name;
                itemElement.appendChild(rarityElement);
            }
            itemElement.addEventListener('click', () => this.showItemDetails(item));
            container.appendChild(itemElement);
        }
    },
    
    showItemDetails: function(item) {
        const modal = document.createElement('div');
        modal.className = 'item-details-modal';
        modal.innerHTML = `
            <div class="item-details-content">
                <div class="item-details-header">
                    <div class="item-icon">${item.emoji}</div>
                    <div class="item-title">
                        <h3>${item.name}</h3>
                        ${item.rarity ? `<div class="item-rarity rarity-${item.rarity.toLowerCase()}">${Items.rarity[item.rarity].name}</div>` : ''}
                    </div>
                    <button class="item-close-button">×</button>
                </div>
                <div class="item-description">${item.description || 'No description available.'}</div>
                <div class="item-stats">
                    <div class="item-stat"><span class="label">Value:</span> <span class="value">${item.value}</span></div>
                    ${item.stats ? Object.entries(item.stats).map(([stat, value]) => `<div class="item-stat"><span class="label">${stat.charAt(0).toUpperCase() + stat.slice(1)}:</span> <span class="value">+${value}</span></div>`).join('') : ''}
                </div>
                <div class="item-actions">
                    ${item.category === Items.categories.CONSUMABLE ? '<button class="item-action-button use-button">Use</button>' : ''}
                    ${item.category === Items.categories.EQUIPMENT ? '<button class="item-action-button equip-button">Equip</button>' : ''}
                    ${item.category === Items.categories.PET ? '<button class="item-action-button equip-pet-button">Equip Pet</button>' : ''}
                    <button class="item-action-button drop-button">Drop</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeButton = modal.querySelector('.item-close-button');
        closeButton.addEventListener('click', () => modal.remove());
        const useButton = modal.querySelector('.use-button');
        if (useButton) {
            useButton.addEventListener('click', () => {
                const result = Items.useItem(item.id);
                if (result.success) {
                    this.showToast(result.message, "success");
                    this.updateInventoryUI();
                    this.updatePlayerProfile();
                    modal.remove();
                } else {
                    this.showToast(result.message, "error");
                }
            });
        }
        const equipButton = modal.querySelector('.equip-button');
        if (equipButton) {
            equipButton.addEventListener('click', () => {
                const result = Items.equipItem(item.id);
                if (result.success) {
                    this.showToast(result.message, "success");
                    this.updateInventoryUI();
                    modal.remove();
                } else {
                    this.showToast(result.message, "error");
                }
            });
        }
        const equipPetButton = modal.querySelector('.equip-pet-button');
        if (equipPetButton) {
            equipPetButton.addEventListener('click', () => {
                const result = Items.equipPet(item.id);
                if (result.success) {
                    this.showToast(result.message, "success");
                    this.updateInventoryUI();
                    modal.remove();
                } else {
                    this.showToast(result.message, "error");
                }
            });
        }
        const dropButton = modal.querySelector('.drop-button');
        if (dropButton) {
            dropButton.addEventListener('click', () => {
                if (confirm(`Are you sure you want to drop ${item.name}?`)) {
                    const index = Player.inventory.findIndex(i => i.id === item.id);
                    if (index !== -1) {
                        Player.inventory.splice(index, 1);
                        this.updateInventoryUI();
                        this.updatePlayerProfile();
                        this.showToast(`Dropped ${item.name}`, "info");
                        modal.remove();
                    }
                }
            });
        }
    },
    
    updateQuestDisplay: function() {
        const questDisplay = document.getElementById('quest-display');
        if (!Game.quests.active) {
            questDisplay.classList.add('hide');
            return;
        }
        questDisplay.innerHTML = `
            <div class="quest-title">${Game.quests.active.name}</div>
            <div class="quest-description">${Game.quests.active.description}</div>
            <div class="quest-progress-container">
                <div class="quest-progress-text">Progress: ${Game.quests.active.progress} / ${Game.quests.active.target}</div>
                <div class="quest-progress-bar">
                    <div class="quest-progress-fill" style="width: ${Math.min(100, (Game.quests.active.progress / Game.quests.active.target) * 100)}%"></div>
                </div>
            </div>
            <div class="quest-reward">Reward: ${Game.quests.active.reward} points</div>
        `;
        questDisplay.classList.remove('hide');
    },
    
    updateLeaderboard: function() {
        const leaderboardEntries = document.getElementById('leaderboard-entries');
        leaderboardEntries.innerHTML = '';
        const activeTab = document.querySelector('#leaderboard-tabs .tab-button.active');
        const type = activeTab ? activeTab.dataset.type : 'score';
        const users = Array.from(Nostr.users.values())
            .filter(user => user.pubkey !== Player.pubkey)
            .sort((a, b) => {
                if (type === 'score') return (b.score || 0) - (a.score || 0);
                else if (type === 'items') return (b.itemsCollected || 0) - (a.itemsCollected || 0);
                else if (type === 'quests') return (b.questsCompleted || 0) - (a.questsCompleted || 0);
                else if (type === 'zaps') return ((b.zapsSent || 0) + (b.zapsReceived || 0)) - ((a.zapsSent || 0) + (a.zapsReceived || 0));
                return 0;
            });
        users.unshift({
            pubkey: Player.pubkey,
            profile: Player.profile,
            score: Player.score,
            itemsCollected: Player.itemsCollected,
            questsCompleted: Player.completedQuests.length,
            zapsSent: Player.zapsSent,
            zapsReceived: Player.zapsReceived
        });
        for (let i = 0; i < Math.min(users.length, 10); i++) {
            const user = users[i];
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            const rank = document.createElement('div');
            rank.className = 'leaderboard-rank';
            rank.textContent = i + 1;
            entry.appendChild(rank);
            const avatar = document.createElement('img');
            avatar.className = 'leaderboard-avatar';
            avatar.src = user.profile?.picture || 'assets/icons/default-avatar.png';
            avatar.alt = 'Avatar';
            entry.appendChild(avatar);
            const info = document.createElement('div');
            info.className = 'leaderboard-info';
            const name = document.createElement('div');
            name.className = 'leaderboard-name';
            name.textContent = user.profile?.name || Utils.formatPubkey(user.pubkey, { short: true });
            
            // Add NPC indicator if applicable
            if (user.isNPC) {
                name.textContent += ' [NPC]';
                name.className += ' npc-user';
            }
            
            info.appendChild(name);
            const score = document.createElement('div');
            score.className = 'leaderboard-score';
            if (type === 'score') score.textContent = `${Utils.formatNumber(user.score || 0)} pts`;
            else if (type === 'items') score.textContent = `${Utils.formatNumber(user.itemsCollected || 0)} items`;
            else if (type === 'quests') score.textContent = `${Utils.formatNumber(user.questsCompleted || 0)} quests`;
            else if (type === 'zaps') score.textContent = `${Utils.formatNumber((user.zapsSent || 0) + (user.zapsReceived || 0))} zaps`;
            info.appendChild(score);
            entry.appendChild(info);
            if (user.pubkey === Player.pubkey) entry.classList.add('current-player');
            if (user.pubkey !== Player.pubkey) entry.addEventListener('click', () => this.showUserPopup(user.pubkey));
            leaderboardEntries.appendChild(entry);
        }
    },
    
    switchTab: function(tabId, container) {
        const tabButtons = container.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tab === tabId || button.dataset.type === tabId) button.classList.add('active');
        });
        if (container.id === 'leaderboard-tabs') this.updateLeaderboard();
        else if (container.id === 'inventory-tabs') this.updateInventoryUI();
    },
    
    showFeatureNotice: function(featureName) {
        this.showToast(`${featureName} feature coming soon!`, "info");
    },
    
    updateWeatherEffects: function(weather) {
        const weatherOverlay = document.getElementById('weather-overlay');
        weatherOverlay.innerHTML = '';
        weatherOverlay.className = 'weather-effect';
        if (weather === 'rain') {
            weatherOverlay.classList.add('rain');
            for (let i = 0; i < 100; i++) {
                const raindrop = document.createElement('div');
                raindrop.className = 'raindrop';
                raindrop.style.left = `${Math.random() * 100}%`;
                raindrop.style.animationDelay = `${Math.random() * 2}s`;
                weatherOverlay.appendChild(raindrop);
            }
        } else if (weather === 'storm') {
            weatherOverlay.classList.add('storm');
            for (let i = 0; i < 200; i++) {
                const raindrop = document.createElement('div');
                raindrop.className = 'raindrop';
                raindrop.style.left = `${Math.random() * 100}%`;
                raindrop.style.animationDelay = `${Math.random() * 2}s`;
                weatherOverlay.appendChild(raindrop);
            }
            const lightning = document.createElement('div');
            lightning.className = 'lightning';
            weatherOverlay.appendChild(lightning);
            setInterval(() => {
                if (Game.weather.current === 'storm') {
                    lightning.style.display = 'block';
                    setTimeout(() => lightning.style.display = 'none', 100);
                }
            }, 5000 + Math.random() * 10000);
        }
    },
    
    updateUserPopup: function(pubkey) {
        const user = Nostr.getUser(pubkey);
        if (!user) return;
        const popup = document.getElementById('user-popup');
        if (popup.classList.contains('hide') || popup.dataset.pubkey !== pubkey) return;
        document.getElementById('user-popup-image').src = user.profile?.picture || 'assets/icons/default-avatar.png';
        document.getElementById('user-popup-name').textContent = user.profile?.name || Utils.formatPubkey(pubkey, { short: true });
        document.getElementById('user-popup-npub').textContent = Utils.formatPubkey(pubkey, { short: true, useNpub: true });
        document.getElementById('user-level').textContent = user.level || '1';
        document.getElementById('user-score').textContent = Utils.formatNumber(user.score || 0);
        document.getElementById('user-guild').textContent = user.guild || 'None';
        document.getElementById('user-faction').textContent = user.faction || 'None';
        this.updateFollowButton(pubkey);
        this.updateUserNotes(pubkey);
    },
    
    addDirectMessage: function(username, message, isFromMe = false) {
        const dmContainer = document.getElementById('direct-message-content');
        if (!dmContainer) return;
        const messageElement = document.createElement('div');
        messageElement.className = `dm-message ${isFromMe ? 'from-me' : 'from-them'}`;
        const contentElement = document.createElement('div');
        contentElement.className = 'dm-content';
        contentElement.textContent = message;
        messageElement.appendChild(contentElement);
        const timestampElement = document.createElement('div');
        timestampElement.className = 'dm-timestamp';
        timestampElement.textContent = new Date().toLocaleTimeString();
        messageElement.appendChild(timestampElement);
        dmContainer.appendChild(messageElement);
        dmContainer.scrollTop = dmContainer.scrollHeight;
    }
};

export default UI;
