/**
 * main.js - Entry point for Relay World
 * Handles initialization and coordinates between modules
 */

const RelayWorld = {
    initialized: false,
    debug: true,
    
    config: {
        WORLD_SIZE: 3000,
        // Relay configuration
        GAME_RELAY: "wss://relay.nostrfreaks.com", // Dedicated game relay for all game events
        LOGIN_RELAY: "wss://relay.damus.io", // Default login and explorer relay
        EXPLORER_RELAYS: [
            "wss://relay.damus.io", // Included as default explorer relay
            "wss://relay.nostr.band",
            "wss://nos.lol",
            "wss://nostr.wine"
        ],
        ACTIVE_EXPLORER_RELAY: "wss://relay.damus.io", // Default active explorer
        
        // Game mechanics configuration
        VOICE_CHAT_RANGE: 300,
        INTERACTION_RANGE: 100,
        NPC_LIMIT: 150, // Maximum number of NPCs to spawn from explorer relay
        
        // Event kinds configuration
        EXPLORER_KINDS: [0, 1, 3, 9, 30023], // Event kinds to fetch from explorer relays
        
        // Game event kinds (420,000 range)
        EVENT_KINDS: {
            POSITION: 420001,
            STATS: 420002,
            ITEM: 420003,
            QUEST: 420004,
            INTERACTION: 420005,
            WEATHER: 420006,
            PORTAL: 420007,
            TREASURE: 420008,
            TRADE: 420009,
            VOICE: 420010
        },
        
        // Game mechanics
        ZAP_AMOUNTS: [21, 210, 2100, 21000]
    },
    
    game: null,
    nostr: null,
    ui: null,
    zaps: null,
    audio: null,
    player: null,
    
    init: function() {
        console.log("[Relay World] Initializing application...");
        
        try {
            this.createTemporaryUI();
            this.logSystemInfo();
            
            if (!window.Utils) throw new Error("Utils module not loaded");
            if (!window.Player) throw new Error("Player module not loaded");
            if (!window.Items) throw new Error("Items module not loaded");
            if (!window.UI) throw new Error("UI module not loaded");
            import('./js/game.js').then(module => {
                window.Game = module.default;
            });

            window.Utils.init();
            window.Player.init();
            window.Items.init();
            window.UI.init();
            window.Game.init();
            
            this.game = window.Game || null;
            this.nostr = window.Nostr || null;
            this.ui = window.UI || null;
            this.zaps = window.Zaps || null;
            this.audio = window.Audio || null;
            this.player = window.Player || null;
            
            const loginButton = document.getElementById('login-button');
            if (loginButton) {
                loginButton.addEventListener('click', this.handleLogin.bind(this));
            }
            
            const nwcButton = document.getElementById('login-nwc');
            if (nwcButton) {
                nwcButton.addEventListener('click', this.handleNWCLogin.bind(this));
            }
            
            const loginExtras = document.querySelector('.login-extras');
            if (loginExtras) loginExtras.classList.add('hide');
            
            const savedPubkey = localStorage.getItem('relayworld_pubkey');
            const savedRelays = localStorage.getItem('relayworld_relays');
            
            if (savedPubkey && savedRelays) {
                this.showTempToast("Previous session found. Click login to reconnect.", "info");
                this.setLoginStatus("Previous session found. Click the button to reconnect.");
            }
            
            if (window.Debug) {
                window.Debug.init();
                window.Debug.runDiagnostics();
                window.Debug.addGlobalDebugMethods();
            }
            
            this.initialized = true;
            console.log("[Relay World] Initialization complete. Ready for login.");
        } catch (error) {
            console.error("[Relay World] Initialization failed:", error);
            this.showTempToast("Failed to initialize game. Please refresh the page.", "error");
        }
    },
    
    logSystemInfo: function() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const isSecure = window.isSecureContext;
        const hasCrypto = !!window.crypto;
        const hasWebSocket = !!window.WebSocket;
        const hasNostrExtension = !!window.nostr;
        
        console.log(`[Relay World] User Agent: ${userAgent}`);
        console.log(`[Relay World] Platform: ${platform}`);
        console.log(`[Relay World] Secure Context: ${isSecure}`);
        console.log(`[Relay World] Has Crypto API: ${hasCrypto}`);
        console.log(`[Relay World] Has WebSocket: ${hasWebSocket}`);
        console.log(`[Relay World] Has Nostr Extension: ${hasNostrExtension}`);
    },
    
    createTemporaryUI: function() {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.position = 'absolute';
            toastContainer.style.top = '20px';
            toastContainer.style.left = '50%';
            toastContainer.style.transform = 'translateX(-50%)';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
    },
    
    showTempToast: function(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        toast.style.backgroundColor = type === 'error' ? '#EF4444' : 
                                     type === 'success' ? '#10B981' : 
                                     type === 'warning' ? '#F59E0B' : '#8B5CF6';
        toast.style.color = '#FFFFFF';
        toast.style.padding = '10px 15px';
        toast.style.borderRadius = '4px';
        toast.style.marginBottom = '10px';
        toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
        toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        toast.style.fontSize = '14px';
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },
    
    setLoginStatus: function(message) {
        const statusElement = document.getElementById('login-status');
        if (statusElement) statusElement.textContent = message;
    },
    
    showNWCOption: function() {
        const loginExtras = document.querySelector('.login-extras');
        if (loginExtras) loginExtras.classList.remove('hide');
        const nwcButton = document.getElementById('login-nwc');
        if (nwcButton) nwcButton.disabled = false;
        if (this.ui) this.ui.showToast("Login successful! Connect your Lightning wallet when ready.", "success");
    },
    
    handleLogin: async function() {
        console.log("[Relay World] Attempting login via NIP-07...");
        this.setLoginStatus("Looking for Nostr extension...");
        
        const loginButton = document.getElementById('login-button');
        const loginLoader = document.getElementById('login-loader');
        
        if (loginButton) loginButton.disabled = true;
        if (loginLoader) loginLoader.style.display = 'block';
        
        try {
            if (!this.nostr) throw new Error("Nostr module not found or not initialized");
            
            const isExtensionAvailable = await this.nostr.isExtensionAvailable();
            if (!isExtensionAvailable) throw new Error("No Nostr extension found. Please install one first.");
            
            this.setLoginStatus("Extension found! Requesting public key...");
            
            const pubkey = await this.nostr.getPublicKey();
            if (!pubkey) throw new Error("Could not get public key from extension.");
            
            this.setLoginStatus("Got public key, connecting to relays...");
            
            if (this.player) this.player.setPubkey(pubkey);
            else throw new Error("Player module not initialized");
            
            await this.connectToRelays();
            await this.startGame();
            this.showNWCOption(); // Moved after startGame
            
            localStorage.setItem('relayworld_pubkey', pubkey);
            localStorage.setItem('relayworld_relays', JSON.stringify([...this.nostr.explorerRelays.keys()]));
            
        } catch (error) {
            console.error("[Relay World] Login failed:", error);
            if (this.ui) this.ui.showToast("Login failed: " + error.message, "error");
            else this.showTempToast("Login failed: " + error.message, "error");
            this.setLoginStatus("Login failed: " + error.message);
            
            if (loginButton) loginButton.disabled = false;
            if (loginLoader) loginLoader.style.display = 'none';
        }
    },
    
    handleNWCLogin: async function() {
        if (!this.player || !this.player.pubkey) {
            this.ui.showToast("Please log in with Nostr first before connecting your wallet", "error");
            return;
        }
        
        console.log("[Relay World] Attempting NWC connection...");
        this.setLoginStatus("Setting up NWC connection...");
        
        const nwcButton = document.getElementById('login-nwc');
        const loginLoader = document.getElementById('login-loader');
        
        if (nwcButton) nwcButton.disabled = true;
        if (loginLoader) loginLoader.style.display = 'block';
        
        try {
            const bcModal = document.getElementById('bitcoin-connect-modal');
            if (bcModal) bcModal.classList.remove('hide');
            else throw new Error("Bitcoin Connect modal not found");
            
        } catch (error) {
            console.error("[Relay World] NWC connection failed:", error);
            this.ui.showToast("NWC connection failed: " + error.message, "error");
            this.setLoginStatus("NWC connection failed: " + error.message);
            
            if (nwcButton) nwcButton.disabled = false;
            if (loginLoader) loginLoader.style.display = 'none';
        }
    },
    
    connectToRelays: async function() {
        this.setLoginStatus("Connecting to relays...");
        
        try {
            if (!this.nostr) throw new Error("Nostr module not initialized");
            
            // 1. Connect to game relay (required)
            try {
                await this.nostr.connectToGameRelay();
            } catch (error) {
                console.error("[Relay World] Failed to connect to game relay:", error);
                throw new Error("Failed to connect to game relay. This is required to play.");
            }
            
            // 2. Connect to login relay (required)
            try {
                await this.nostr.connectToLoginRelay();
            } catch (error) {
                console.error("[Relay World] Failed to connect to login relay:", error);
                throw new Error("Failed to connect to login relay. This is required to play.");
            }
            
            // 3. Connect to additional explorer relays
            let connectedExplorers = 1; // Starting with 1 for the login relay
            
            for (const relayUrl of this.config.EXPLORER_RELAYS) {
                // Skip login relay as we've already connected to it
                if (relayUrl === this.config.LOGIN_RELAY) continue;
                
                try {
                    await this.nostr.connectToExplorerRelay(relayUrl);
                    connectedExplorers++;
                } catch (error) {
                    console.warn(`[Relay World] Failed to connect to explorer relay ${relayUrl}: ${error.message}`);
                }
            }
            
            this.setLoginStatus(`Connected to all required relays and ${connectedExplorers} explorer relays successfully!`);
            return true;
            
        } catch (error) {
            console.error("[Relay World] Failed to connect to relays:", error);
            throw new Error("Failed to connect to relays: " + error.message);
        }
    },
    
    startGame: async function() {
        this.setLoginStatus("Starting game...");
        
        try {
            if (!this.nostr || !this.game) throw new Error("Required modules not initialized");
            
            await this.nostr.loadPlayerProfile();
            this.game.start();
            
            if (this.audio) this.audio.init();
            if (this.zaps) this.zaps.initAfterLogin();
            
            // Subscribe to game events from game relay
            this.nostr.subscribeToGameEvents();
            
            // Subscribe to explorer content from active explorer relay
            this.nostr.subscribeToExplorerContent();
            
            this.game.generateWorldItems();
            
            if (this.ui) {
                this.ui.updatePlayerProfile();
                this.ui.updateRelaySelector();
                this.ui.hideLoginScreen();
                this.ui.showToast("Welcome to Relay World!", "success");
            }
            
            return true;
            
        } catch (error) {
            console.error("[Relay World] Failed to start game:", error);
            throw new Error("Failed to start game: " + error.message);
        }
    },
    
    log: function(message, type = 'info') {
        if (!this.debug) return;
        
        switch (type) {
            case 'error':
                console.error(`[Relay World] ${message}`);
                break;
            case 'warn':
                console.warn(`[Relay World] ${message}`);
                break;
            case 'success':
                console.log(`[Relay World] %c${message}`, 'color: green');
                break;
            default:
                console.log(`[Relay World] ${message}`);
        }
    }
};

window.addEventListener('beforeunload', () => {
    if (RelayWorld.audio) RelayWorld.audio.cleanupVoiceChat();
    if (RelayWorld.nostr) RelayWorld.nostr.closeAllRelays();
});

export default RelayWorld;
