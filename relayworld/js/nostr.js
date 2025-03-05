/**
 * nostr.js - Nostr relay interactions for Relay World
 * Handles connecting to relays, subscribing to events, and publishing events
 */

const Nostr = {
    // Categorized relay connections
    gameRelay: null,          // Single dedicated game relay
    loginRelay: null,         // Login and default explorer relay
    explorerRelays: new Map(), // Map of URL -> explorer relay connection
    activeExplorerRelay: null, // Currently active explorer relay
    
    // User data
    users: new Map(), // Map of pubkey -> user data
    
    // Subscription IDs
    subscriptions: new Map(),
    
    // Check if a Nostr extension is available
    isExtensionAvailable: function(timeout = 3000) {
        return new Promise((resolve) => {
            // Check if extension is already available
            if (window.nostr && typeof window.nostr.getPublicKey === 'function') {
                resolve(true);
                return;
            }
            
            // Set timeout for extension check
            const timer = setTimeout(() => {
                console.log("[Nostr] No extension found within timeout period");
                resolve(false);
            }, timeout);
            
            // Poll for extension
            const interval = setInterval(() => {
                if (window.nostr && typeof window.nostr.getPublicKey === 'function') {
                    clearInterval(interval);
                    clearTimeout(timer);
                    console.log("[Nostr] Extension found");
                    resolve(true);
                }
            }, 100);
        });
    },
    
    // Get public key from extension
    getPublicKey: async function() {
        try {
            // Make sure the extension is available
            const isAvailable = await this.isExtensionAvailable(1000);
            if (!isAvailable) {
                throw new Error("Nostr extension not found or not ready");
            }
            
            // Request public key with error handling
            const pubkey = await window.nostr.getPublicKey();
            
            // Validate public key format (simple check)
            if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
                throw new Error("Invalid public key format");
            }
            
            console.log(`[Nostr] Got public key: ${pubkey.substring(0, 8)}...`);
            return pubkey;
        } catch (error) {
            console.error("[Nostr] Failed to get public key:", error);
            
            // Provide more helpful error messages
            if (error.message && error.message.includes("User rejected")) {
                throw new Error("You rejected the public key request. Please approve it to continue.");
            } else if (error.message && error.message.includes("timeout")) {
                throw new Error("Request to your Nostr extension timed out. Please try again.");
            } else {
                throw error;
            }
        }
    },
    
    // Connect to game relay
    connectToGameRelay: async function() {
        try {
            const url = RelayWorld.config.GAME_RELAY;
            console.log(`[Nostr] Connecting to game relay: ${url}`);
            
            this.gameRelay = await this.connectRelay(url);
            console.log("[Nostr] Connected to game relay successfully");
            
            return this.gameRelay;
        } catch (error) {
            console.error("[Nostr] Failed to connect to game relay:", error);
            throw error;
        }
    },
    
    // Connect to login relay
    connectToLoginRelay: async function() {
        try {
            const url = RelayWorld.config.LOGIN_RELAY;
            console.log(`[Nostr] Connecting to login relay: ${url}`);
            
            this.loginRelay = await this.connectRelay(url);
            
            // Also add it to explorer relays
            this.explorerRelays.set(url, this.loginRelay);
            this.activeExplorerRelay = url;
            
            console.log("[Nostr] Connected to login relay successfully");
            
            return this.loginRelay;
        } catch (error) {
            console.error("[Nostr] Failed to connect to login relay:", error);
            throw error;
        }
    },
    
    // Connect to explorer relay
    connectToExplorerRelay: async function(url) {
        // Skip if it's already connected or it's the login relay
        if (this.explorerRelays.has(url)) {
            return this.explorerRelays.get(url);
        }
        
        try {
            console.log(`[Nostr] Connecting to explorer relay: ${url}`);
            
            const relay = await this.connectRelay(url);
            this.explorerRelays.set(url, relay);
            
            console.log(`[Nostr] Connected to explorer relay: ${url}`);
            return relay;
        } catch (error) {
            console.error(`[Nostr] Failed to connect to explorer relay ${url}:`, error);
            throw error;
        }
    },
    
    // Connect to a relay - Fixed using a direct WebSocket approach
    connectRelay: async function(url) {
        try {
            // Check if already connected
            if (this.explorerRelays.has(url) && 
                this.explorerRelays.get(url).socket?.readyState === WebSocket.OPEN) {
                console.log(`[Nostr] Already connected to relay: ${url}`);
                return this.explorerRelays.get(url);
            }
            
            if (url === RelayWorld.config.GAME_RELAY && 
                this.gameRelay?.socket?.readyState === WebSocket.OPEN) {
                return this.gameRelay;
            }
            
            console.log(`[Nostr] Connecting to relay: ${url}`);
            
            // Create a new WebSocket connection
            const ws = new WebSocket(url);
            
            // Wrap the WebSocket in a Promise to handle connection
            const connectionPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Connection to ${url} timed out`));
                }, 5000);
                
                ws.onopen = () => {
                    clearTimeout(timeoutId);
                    
                    // Add custom methods to the WebSocket
                    const relay = {
                        url,
                        socket: ws,
                        
                        // Subscription method
                        sub: (filters, options = {}) => {
                            return this.createSubscription(relay, filters, options);
                        },
                        
                        // Publish method
                        publish: (event) => {
                            return this.publishToRelay(relay, event);
                        },
                        
                        // Close method
                        close: () => {
                            ws.close();
                            if (url === RelayWorld.config.GAME_RELAY) {
                                this.gameRelay = null;
                            } else if (url === RelayWorld.config.LOGIN_RELAY) {
                                this.loginRelay = null;
                            }
                            this.explorerRelays.delete(url);
                        }
                    };
                    
                    // Set up message handler
                    ws.onmessage = (event) => {
                        this.handleRelayMessage(url, event.data);
                    };
                    
                    resolve(relay);
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeoutId);
                    console.error(`[Nostr] WebSocket error for ${url}:`, error);
                    reject(error);
                };
                
                ws.onclose = () => {
                    console.log(`[Nostr] WebSocket closed for ${url}`);
                    
                    if (url === RelayWorld.config.GAME_RELAY) {
                        this.gameRelay = null;
                    } else if (url === RelayWorld.config.LOGIN_RELAY) {
                        this.loginRelay = null;
                    }
                    this.explorerRelays.delete(url);
                    
                    // Attempt to reconnect if game is still running
                    if (typeof Game !== 'undefined' && Game.running) {
                        setTimeout(() => {
                            this.connectRelay(url).catch(err => 
                                console.error(`[Nostr] Failed to reconnect to ${url}:`, err)
                            );
                        }, 5000);
                    }
                };
            });
            
            const relay = await connectionPromise;
            console.log(`[Nostr] Connected to relay: ${url}`);
            return relay;
            
        } catch (error) {
            console.error(`[Nostr] Failed to connect to relay ${url}:`, error);
            
            // Provide more helpful error messages
            if (error.message && error.message.includes("timed out")) {
                throw new Error(`Connection to ${url} timed out. The relay might be down.`);
            } else if (error.message && error.message.includes("Invalid URL")) {
                throw new Error(`${url} is not a valid WebSocket URL.`);
            } else {
                throw error;
            }
        }
    },
    
    // Create a subscription object - Fixed implementation
    createSubscription: function(relay, filters, options = {}) {
        const subId = options.id || Math.random().toString(36).substring(2, 15);
        
        const sub = {
            id: subId,
            filters,
            relay: relay,
            
            // Event handlers
            eventHandlers: [],
            eoseHandlers: [],
            
            // Add event handler
            on: function(event, handler) {
                if (event === 'event') {
                    this.eventHandlers.push(handler);
                } else if (event === 'eose') {
                    this.eoseHandlers.push(handler);
                }
                return this;
            },
            
            // Unsubscribe
            unsub: function() {
                try {
                    const msg = JSON.stringify(["CLOSE", subId]);
                    relay.socket.send(msg);
                    
                    // Clean up subscription
                    Nostr.subscriptions.delete(subId);
                } catch (error) {
                    console.error(`[Nostr] Failed to unsubscribe from ${subId}:`, error);
                }
            }
        };
        
        // Store subscription
        this.subscriptions.set(subId, sub);
        
        // Send subscription request
        try {
            const msg = JSON.stringify(["REQ", subId, ...filters]);
            relay.socket.send(msg);
        } catch (error) {
            console.error(`[Nostr] Failed to send subscription request:`, error);
            this.subscriptions.delete(subId);
            throw error;
        }
        
        return sub;
    },
    
    // Publish to relay - Fixed implementation
    publishToRelay: function(relay, event) {
        return new Promise((resolve, reject) => {
            if (!relay.socket || relay.socket.readyState !== WebSocket.OPEN) {
                reject(new Error("WebSocket is not open"));
                return;
            }
            
            try {
                const msg = JSON.stringify(["EVENT", event]);
                relay.socket.send(msg);
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    },
    
    // Handle relay message
    handleRelayMessage: function(relayUrl, data) {
        let parsed;
        try {
            if (typeof data === 'string') {
                parsed = JSON.parse(data);
            } else {
                parsed = data;
            }
        } catch (error) {
            console.error(`[Nostr] Failed to parse relay message:`, error);
            return;
        }
        
        if (!Array.isArray(parsed)) return;
        
        const [type, ...rest] = parsed;
        
        switch (type) {
            case 'EVENT':
                const [subId, event] = rest;
                // Route game events and explorer events differently
                if (relayUrl === RelayWorld.config.GAME_RELAY) {
                    this.handleGameEvent(event, subId);
                } else {
                    this.handleExplorerEvent(event, subId, relayUrl);
                }
                break;
                
            case 'EOSE':
                const [eoseSubId] = rest;
                this.handleEOSE(eoseSubId, relayUrl);
                break;
                
            case 'NOTICE':
                const [notice] = rest;
                console.log(`[Nostr] Notice from ${relayUrl}:`, notice);
                break;
                
            case 'OK':
                const [eventId, success, message] = rest;
                this.handleOK(eventId, success, message, relayUrl);
                break;
                
            default:
                console.log(`[Nostr] Unknown message type from ${relayUrl}:`, type, rest);
        }
    },
    
    // Handle game events (game relay)
    handleGameEvent: function(event, subId) {
        if (!event || !event.pubkey) return;
        
        // Find subscription
        const sub = this.subscriptions.get(subId);
        if (sub && sub.eventHandlers && sub.eventHandlers.length > 0) {
            // Call event handlers
            for (const handler of sub.eventHandlers) {
                handler(event);
            }
        }
        
        // Process game event
        this.processGameEvent(event);
    },
    
    // Handle explorer events (explorer relays)
    handleExplorerEvent: function(event, subId, relayUrl) {
        if (!event || !event.pubkey) return;
        
        // Find subscription
        const sub = this.subscriptions.get(subId);
        if (sub && sub.eventHandlers && sub.eventHandlers.length > 0) {
            // Call event handlers
            for (const handler of sub.eventHandlers) {
                handler(event);
            }
        }
        
        // Process explorer event
        this.processExplorerEvent(event, relayUrl);
    },
    
    // Handle EOSE (End of Stored Events) message
    handleEOSE: function(subId, relayUrl) {
        const sub = this.subscriptions.get(subId);
        if (sub && sub.eoseHandlers && sub.eoseHandlers.length > 0) {
            // Call EOSE handlers
            for (const handler of sub.eoseHandlers) {
                handler();
            }
        }
    },
    
    // Handle OK message
    handleOK: function(eventId, success, message, relayUrl) {
        if (success) {
            console.log(`[Nostr] Event ${eventId} published successfully to ${relayUrl}`);
        } else {
            console.error(`[Nostr] Failed to publish event ${eventId} to ${relayUrl}: ${message}`);
        }
    },
    
    // Set active explorer relay
    setActiveExplorerRelay: function(url) {
        if (this.explorerRelays.has(url)) {
            this.activeExplorerRelay = url;
            console.log(`[Nostr] Set active explorer relay to ${url}`);
            
            // Update UI
            if (typeof UI !== 'undefined' && typeof UI.updateRelaySelector === 'function') {
                UI.updateRelaySelector();
            }
            
            // Fetch users and notes from active explorer relay
            this.fetchUsersFromExplorerRelay();
            
            return true;
        }
        
        return false;
    },
    
    // Subscribe to game events on game relay
    subscribeToGameEvents: function() {
        if (!this.gameRelay) {
            console.error("[Nostr] Game relay not connected");
            return false;
        }
        
        console.log("[Nostr] Subscribing to game events...");
        
        // Create a list of all game event kinds
        const gameKinds = Object.values(RelayWorld.config.EVENT_KINDS);
        
        // Subscribe to all game events
        const filters = [{ kinds: gameKinds }];
        
        try {
            this.subscribe(this.gameRelay, filters, 
                (event) => this.processGameEvent(event),
                () => console.log("[Nostr] Game events subscription complete")
            );
            return true;
        } catch (error) {
            console.error("[Nostr] Failed to subscribe to game events:", error);
            return false;
        }
    },
    
    // Subscribe to explorer content on active explorer relay
    subscribeToExplorerContent: function() {
        if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
            console.error("[Nostr] No active explorer relay");
            return false;
        }
        
        const relay = this.explorerRelays.get(this.activeExplorerRelay);
        
        console.log(`[Nostr] Subscribing to explorer content on ${this.activeExplorerRelay}...`);
        
        // Subscribe to standard Nostr content
        const filters = [{ kinds: RelayWorld.config.EXPLORER_KINDS }];
        
        try {
            this.subscribe(relay, filters, 
                (event) => this.processExplorerEvent(event, this.activeExplorerRelay),
                () => console.log(`[Nostr] Explorer content subscription complete for ${this.activeExplorerRelay}`)
            );
            
            // Additionally, fetch user profiles and notes
            this.fetchUsersFromExplorerRelay();
            
            return true;
        } catch (error) {
            console.error("[Nostr] Failed to subscribe to explorer content:", error);
            return false;
        }
    },
    
    // Process game event
    processGameEvent: function(event) {
        // Handle based on kind
        const kinds = RelayWorld.config.EVENT_KINDS;
        
        switch (event.kind) {
            case kinds.POSITION:
                this.handlePositionEvent(event);
                break;
            case kinds.STATS:
                this.handleStatsEvent(event);
                break;
            case kinds.ITEM:
                this.handleItemEvent(event);
                break;
            case kinds.QUEST:
                this.handleQuestEvent(event);
                break;
            case kinds.INTERACTION:
                this.handleInteractionEvent(event);
                break;
            case kinds.WEATHER:
                this.handleWeatherEvent(event);
                break;
            case kinds.PORTAL:
                this.handlePortalEvent(event);
                break;
            case kinds.TREASURE:
                this.handleTreasureEvent(event);
                break;
            case kinds.TRADE:
                this.handleTradeEvent(event);
                break;
            case kinds.VOICE:
                this.handleVoiceEvent(event);
                break;
            default:
                console.log(`[Nostr] Unhandled game event kind: ${event.kind}`);
        }
    },
    
    // Process explorer event
    processExplorerEvent: function(event, relayUrl) {
        // Create user entry if not exists (potential NPC)
        if (!this.users.has(event.pubkey)) {
            this.createNPC(event.pubkey);
        }
        
        const user = this.users.get(event.pubkey);
        
        // Process based on kind
        switch (event.kind) {
            case 0: // Profile metadata
                this.handleProfileEvent(event, user);
                break;
            case 1: // Regular note
                this.handleNoteEvent(event, user);
                break;
            case 3: // Contacts/following list
                this.handleContactsEvent(event, user);
                break;
            case 9: // Chat messages
                this.handleChatEvent(event, user);
                break;
            case 4: // Direct messages
                this.handleDirectMessageEvent(event, user);
                break;
            case 30023: // Long-form content
                this.handleLongFormEvent(event, user);
                break;
        }
    },
    
    // Create an NPC based on explorer relay author
    createNPC: function(pubkey) {
        if (this.users.has(pubkey)) return;
        
        // Generate a semi-deterministic position for NPCs
        let x = 1500, y = 1500; // Default to middle if CryptoJS not available
        
        if (typeof CryptoJS !== 'undefined') {
            const hash = CryptoJS.SHA256(pubkey).toString();
            x = parseInt(hash.substring(0, 8), 16) % (Game?.world?.width || 3000);
            y = parseInt(hash.substring(8, 16), 16) % (Game?.world?.height || 3000);
        }
        
        this.users.set(pubkey, {
            pubkey: pubkey,
            profile: null,
            x, y,
            notes: [],
            score: 0,
            itemsCollected: 0,
            questsCompleted: 0,
            following: new Set(),
            followers: new Set(),
            lastSeen: Date.now(),
            bobOffset: 0,
            isNPC: true // Flag to identify NPCs vs live players
        });
        
        // Fetch profile for this NPC
        this.fetchUserProfile(pubkey);
    },
    
    // Fetch users from active explorer relay
    fetchUsersFromExplorerRelay: function() {
        if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
            console.error("[Nostr] No active explorer relay");
            return false;
        }
        
        const relay = this.explorerRelays.get(this.activeExplorerRelay);
        console.log(`[Nostr] Fetching users from ${this.activeExplorerRelay}...`);
        
        // Fetch unique authors of notes (kind 1)
        const filters = [{ 
            kinds: [1], 
            limit: RelayWorld.config.NPC_LIMIT 
        }];
        
        try {
            this.subscribe(relay, filters, 
                (event) => {
                    // Create NPC for each unique author
                    if (!this.users.has(event.pubkey)) {
                        this.createNPC(event.pubkey);
                    }
                },
                () => console.log(`[Nostr] Completed fetching users from ${this.activeExplorerRelay}`)
            );
            return true;
        } catch (error) {
            console.error("[Nostr] Failed to fetch users from explorer relay:", error);
            return false;
        }
    },
    
    // Fetch profile for a user/NPC
    fetchUserProfile: function(pubkey) {
        if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
            return false;
        }
        
        const relay = this.explorerRelays.get(this.activeExplorerRelay);
        
        // Fetch profile metadata (kind 0)
        const filters = [{ 
            kinds: [0], 
            authors: [pubkey],
            limit: 1
        }];
        
        try {
            this.subscribe(relay, filters, 
                (event) => this.processExplorerEvent(event, this.activeExplorerRelay),
                () => {} // No EOSE handler needed
            );
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to fetch profile for ${pubkey}:`, error);
            return false;
        }
    },
    
    // Fetch notes for a user/NPC
    fetchUserNotes: function(pubkey) {
        if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
            return false;
        }
        
        const relay = this.explorerRelays.get(this.activeExplorerRelay);
        
        // Fetch notes (kind 1)
        const filters = [{ 
            kinds: [1], 
            authors: [pubkey],
            limit: 20
        }];
        
        try {
            this.subscribe(relay, filters, 
                (event) => this.processExplorerEvent(event, this.activeExplorerRelay),
                () => {} // No EOSE handler needed
            );
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to fetch notes for ${pubkey}:`, error);
            return false;
        }
    },
    
    // Handle profile metadata event (kind 0)
    handleProfileEvent: function(event, user) {
        try {
            const profile = JSON.parse(event.content);
            
            user.profile = {
                name: profile.name || profile.display_name || user.pubkey.slice(0, 8),
                picture: profile.picture || null,
                about: profile.about || "",
                website: profile.website || "",
                nip05: profile.nip05 || null,
                lud16: profile.lud16 || profile.lightning_address || null,
                banner: profile.banner || null
            };
            
            console.log(`[Nostr] Updated profile for ${user.pubkey.slice(0, 8)}`);
            
            // Update UI if this is the current player
            if (typeof Player !== 'undefined' && user.pubkey === Player.pubkey) {
                Player.profile = user.profile;
                if (typeof UI !== 'undefined' && typeof UI.updatePlayerProfile === 'function') {
                    UI.updatePlayerProfile();
                }
            }
            
            // Update UI if showing this user
            const userPopup = document.getElementById('user-popup');
            if (userPopup && userPopup.dataset.pubkey === user.pubkey && typeof UI !== 'undefined') {
                if (typeof UI.updateUserPopup === 'function') {
                    UI.updateUserPopup(user.pubkey);
                }
            }
            
            // Update leaderboard
            if (typeof UI !== 'undefined' && typeof UI.updateLeaderboard === 'function') {
                UI.updateLeaderboard();
            }
        } catch (error) {
            console.error(`[Nostr] Failed to parse profile:`, error);
        }
    },
    
    // Handle note event (kind 1)
    handleNoteEvent: function(event, user) {
        // Add to user's notes
        user.notes.unshift({
            id: event.id,
            content: event.content,
            created_at: event.created_at,
            tags: event.tags
        });
        
        // Limit to 20 most recent notes
        if (user.notes.length > 20) {
            user.notes.pop();
        }
        
        // Update UI if showing this user
        const userPopup = document.getElementById('user-popup');
        if (userPopup && userPopup.dataset.pubkey === user.pubkey && typeof UI !== 'undefined') {
            if (typeof UI.updateUserNotes === 'function') {
                UI.updateUserNotes(user.pubkey);
            }
        }
    },
    
    // Handle contacts/following list event (kind 3)
    handleContactsEvent: function(event, user) {
        // Parse followed pubkeys from tags
        user.following = new Set();
        
        for (const tag of event.tags) {
            if (tag[0] === 'p' && tag[1]) {
                user.following.add(tag[1]);
                
                // Add as follower to the followed user
                if (this.users.has(tag[1])) {
                    this.users.get(tag[1]).followers.add(user.pubkey);
                }
            }
        }
        
        console.log(`[Nostr] Updated contacts for ${user.pubkey.slice(0, 8)}: ${user.following.size} following`);
        
        // Update follow button if showing this user
        const userPopup = document.getElementById('user-popup');
        if (userPopup && userPopup.dataset.pubkey === user.pubkey && typeof UI !== 'undefined') {
            if (typeof UI.updateFollowButton === 'function') {
                UI.updateFollowButton(user.pubkey);
            }
        }
    },
    
    // Handle chat message (kind 9)
    handleChatEvent: function(event, user) {
        // Add to global chat
        if (typeof Player !== 'undefined' && user.pubkey !== Player.pubkey) {
            const username = user.profile?.name || user.pubkey.slice(0, 8);
            if (typeof UI !== 'undefined' && typeof UI.addChatMessage === 'function') {
                UI.addChatMessage(username, event.content);
            }
            
            // Play notification sound if message is recent
            if (Date.now() / 1000 - event.created_at < 5) {
                if (typeof UI !== 'undefined' && typeof UI.playSound === 'function') {
                    UI.playSound("chat");
                }
            }
        }
    },
    
    // Handle direct message event (kind 4)
    handleDirectMessageEvent: function(event, user) {
        // Only process if addressed to current player
        if (typeof Player === 'undefined' || !Player.pubkey) return;
        
        const recipientTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === Player.pubkey);
        if (!recipientTag) return;
        
        // Try to decrypt message
        this.decryptMessage(event.content, user.pubkey)
            .then(decrypted => {
                if (!decrypted) return;
                
                const username = user.profile?.name || user.pubkey.slice(0, 8);
                
                // Add to direct message UI if open
                const userPopup = document.getElementById('user-popup');
                if (userPopup && userPopup.dataset.pubkey === user.pubkey && typeof UI !== 'undefined') {
                    if (typeof UI.addDirectMessage === 'function') {
                        UI.addDirectMessage(username, decrypted, false);
                    }
                } else if (typeof UI !== 'undefined') {
                    // Show notification
                    if (typeof UI.showToast === 'function') {
                        UI.showToast(`New message from ${username}`, "info");
                    }
                    
                    // Play notification sound
                    if (typeof UI.playSound === 'function') {
                        UI.playSound("chat");
                    }
                }
            })
            .catch(error => {
                console.error(`[Nostr] Failed to decrypt message:`, error);
            });
    },
    
    // Handle long-form content event (kind 30023)
    handleLongFormEvent: function(event, user) {
        // Process long-form content (blog posts, articles)
        // For now, just add to notes
        this.handleNoteEvent(event, user);
    },
    
    // Handle position event (420001)
    handlePositionEvent: function(event) {
        // Create user if not exists
        if (!this.users.has(event.pubkey)) {
            this.users.set(event.pubkey, {
                pubkey: event.pubkey,
                profile: null,
                x: 0, y: 0,
                notes: [],
                score: 0,
                itemsCollected: 0,
                questsCompleted: 0,
                following: new Set(),
                followers: new Set(),
                lastSeen: Date.now(),
                bobOffset: 0,
                isNPC: false // Live player, not an NPC
            });
            
            // Try to fetch their profile
            this.fetchUserProfile(event.pubkey);
        }
        
        const user = this.users.get(event.pubkey);
        
        try {
            const position = JSON.parse(event.content);
            
            if (position.x !== undefined && position.y !== undefined) {
                user.x = position.x;
                user.y = position.y;
                user.lastSeen = Date.now();
                user.isNPC = false; // Mark as live player
            }
        } catch (error) {
            console.error(`[Nostr] Failed to parse position update:`, error);
        }
    },
    
    // Handle stats event (420002)
    handleStatsEvent: function(event) {
        if (!this.users.has(event.pubkey)) {
            // Create user if not exists but mark as not NPC
            this.users.set(event.pubkey, {
                pubkey: event.pubkey,
                profile: null,
                x: 0, y: 0,
                notes: [],
                score: 0,
                itemsCollected: 0,
                questsCompleted: 0,
                following: new Set(),
                followers: new Set(),
                lastSeen: Date.now(),
                bobOffset: 0,
                isNPC: false // Live player, not an NPC
            });
        }
        
        const user = this.users.get(event.pubkey);
        
        try {
            const stats = JSON.parse(event.content);
            
            if (stats.score !== undefined) user.score = stats.score;
            if (stats.itemsCollected !== undefined) user.itemsCollected = stats.itemsCollected;
            if (stats.questsCompleted !== undefined) user.questsCompleted = stats.questsCompleted;
            
            // Update player stats if this is the current player
            if (typeof Player !== 'undefined' && user.pubkey === Player.pubkey) {
                if (stats.score !== undefined) Player.score = stats.score;
                if (typeof UI !== 'undefined' && typeof UI.updatePlayerProfile === 'function') {
                    UI.updatePlayerProfile();
                }
            }
            
            // Update leaderboard
            if (typeof UI !== 'undefined' && typeof UI.updateLeaderboard === 'function') {
                UI.updateLeaderboard();
            }
        } catch (error) {
            console.error(`[Nostr] Failed to parse stats update:`, error);
        }
    },
    
    // Handle item event (420003)
    handleItemEvent: function(event) {
        // Implementation for item collection events
        // Process tags to find item ID
        const itemTag = event.tags.find(tag => tag[0] === 'i');
        if (!itemTag || !itemTag[1]) return;
        
        const itemId = itemTag[1];
        
        // Handle the item collection - could trigger effects, update world state, etc.
        console.log(`[Nostr] User ${event.pubkey.slice(0, 8)} collected item ${itemId}`);
    },
    
    // Handle quest event (420004)
    handleQuestEvent: function(event) {
        // Implementation for quest events
        const actionTag = event.tags.find(tag => tag[0] === 'a');
        const questTag = event.tags.find(tag => tag[0] === 'q');
        
        if (!actionTag || !questTag) return;
        
        const action = actionTag[1];
        const questId = questTag[1];
        
        console.log(`[Nostr] Quest ${action} - ${questId} by ${event.pubkey.slice(0, 8)}`);
        
        // Update game state based on quest action
        if (typeof Game !== 'undefined' && Game.quests) {
            // Handle quest progress updates
        }
    },
    
    // Handle interaction event (420005)
    handleInteractionEvent: function(event) {
        // Implementation for player interaction events
    },
    
    // Handle weather event (420006)
    handleWeatherEvent: function(event) {
        try {
            const data = JSON.parse(event.content);
            
            if (data.type && typeof Game !== 'undefined' && Game.weather) {
                // Update weather in the game
                Game.weather.current = data.type;
                
                // Update UI
                if (typeof UI !== 'undefined' && typeof UI.updateWeatherEffects === 'function') {
                    UI.updateWeatherEffects(data.type);
                }
                
                console.log(`[Nostr] Weather changed to ${data.type}`);
            }
        } catch (error) {
            console.error(`[Nostr] Failed to parse weather event:`, error);
        }
    },
    
    // Handle portal event (420007)
    handlePortalEvent: function(event) {
        // Implementation for portal/teleport events
    },
    
    // Handle treasure event (420008)
    handleTreasureEvent: function(event) {
        // Implementation for treasure events
    },
    
    // Handle trade event (420009)
    handleTradeEvent: function(event) {
        // Implementation for trade events
    },
    
    // Handle voice event (420010)
    handleVoiceEvent: function(event) {
        // Implementation for voice chat events
    },
    
    // Sign an event
    signEvent: async function(event) {
        try {
            // Add missing fields
            if (!event.created_at) {
                event.created_at = Math.floor(Date.now() / 1000);
            }
            if (!event.pubkey && typeof Player !== 'undefined') {
                event.pubkey = Player.pubkey;
            }
            
            // Check if extension is available
            if (!window.nostr) {
                throw new Error("Nostr extension not found");
            }
            
            // Sign the event
            const signedEvent = await window.nostr.signEvent(event);
            
            // Validate the signed event has an id and signature
            if (!signedEvent.id || !signedEvent.sig) {
                throw new Error("Event signing failed - missing id or signature");
            }
            
            return signedEvent;
        } catch (error) {
            console.error(`[Nostr] Failed to sign event:`, error);
            
            // Provide more helpful error messages
            if (error.message && error.message.includes("User rejected")) {
                throw new Error("You rejected the signing request. Please approve it to continue.");
            } else if (error.message && error.message.includes("timeout")) {
                throw new Error("Request to your Nostr extension timed out. Please try again.");
            } else {
                throw error;
            }
        }
    },
    
    // Publish an event to a relay
    publishEvent: async function(relay, event) {
        try {
            const signedEvent = await this.signEvent(event);
            await relay.publish(signedEvent);
            return signedEvent;
        } catch (error) {
            console.error(`[Nostr] Failed to publish event:`, error);
            throw error;
        }
    },
    
    // Subscribe to events from a relay
    subscribe: function(relay, filters, onEvent, onEOSE) {
        try {
            const sub = relay.sub(filters);
            
            sub.on('event', onEvent);
            if (onEOSE) {
                sub.on('eose', onEOSE);
            }
            
            return sub;
        } catch (error) {
            console.error(`[Nostr] Failed to subscribe:`, error);
            throw error;
        }
    },
    
    // Close a relay connection
    closeRelay: function(url) {
        // Game relay
        if (url === RelayWorld.config.GAME_RELAY && this.gameRelay) {
            this.gameRelay.close();
            this.gameRelay = null;
            console.log(`[Nostr] Closed game relay connection`);
            return;
        }
        
        // Login relay (also an explorer relay)
        if (url === RelayWorld.config.LOGIN_RELAY && this.loginRelay) {
            this.loginRelay.close();
            this.loginRelay = null;
            this.explorerRelays.delete(url);
            console.log(`[Nostr] Closed login relay connection`);
            return;
        }
        
        // Explorer relay
        const relay = this.explorerRelays.get(url);
        if (relay) {
            relay.close();
            this.explorerRelays.delete(url);
            console.log(`[Nostr] Closed explorer relay connection: ${url}`);
        }
    },
    
    // Close all relay connections
    closeAllRelays: function() {
        // Close game relay
        if (this.gameRelay) {
            this.gameRelay.close();
            this.gameRelay = null;
        }
        
        // Close login relay
        if (this.loginRelay) {
            this.loginRelay.close();
            this.loginRelay = null;
        }
        
        // Close all explorer relays
        for (const [url, relay] of this.explorerRelays) {
            relay.close();
        }
        
        this.explorerRelays.clear();
        this.activeExplorerRelay = null;
        
        console.log(`[Nostr] Closed all relay connections`);
    },
    
    // Publish player position update (420001)
    publishPlayerPosition: function(x, y) {
        if (typeof Player === 'undefined' || !Player.pubkey || !this.gameRelay) return;
        
        const event = {
            kind: RelayWorld.config.EVENT_KINDS.POSITION,
            content: JSON.stringify({ x, y }),
            tags: [
                ["t", "position"],
                ["t", "game"]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish only to game relay
        this.publishEvent(this.gameRelay, event).catch(error => {
            console.error(`[Nostr] Failed to publish position:`, error);
        });
    },
    
    // Publish player stats update (420002)
    publishPlayerStats: function() {
        if (typeof Player === 'undefined' || !Player.pubkey || !this.gameRelay) return;
        
        const event = {
            kind: RelayWorld.config.EVENT_KINDS.STATS,
            content: JSON.stringify({
                score: Player.score,
                itemsCollected: Player.itemsCollected,
                questsCompleted: Player.completedQuests.length
            }),
            tags: [
                ["t", "stats"],
                ["t", "game"]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish to game relay
        this.publishEvent(this.gameRelay, event).catch(error => {
            console.error(`[Nostr] Failed to publish stats:`, error);
        });
    },
    
    // Publish item collection event (420003)
    publishItemCollection: function(itemId) {
        if (typeof Player === 'undefined' || !Player.pubkey || !this.gameRelay) return;
        
        const event = {
            kind: RelayWorld.config.EVENT_KINDS.ITEM,
            content: JSON.stringify({ itemId }),
            tags: [
                ["t", "item"],
                ["t", "game"],
                ["i", itemId]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish to game relay
        this.publishEvent(this.gameRelay, event).catch(error => {
            console.error(`[Nostr] Failed to publish item collection:`, error);
        });
    },
    
    // Publish quest event (420004)
    publishQuestEvent: function(action, questId, reward) {
        if (typeof Player === 'undefined' || !Player.pubkey || !this.gameRelay) return;
        
        const event = {
            kind: RelayWorld.config.EVENT_KINDS.QUEST,
            content: JSON.stringify({ 
                action, 
                questId,
                reward: reward || 0
            }),
            tags: [
                ["t", "quest"],
                ["t", "game"],
                ["q", questId],
                ["a", action]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish to game relay
        this.publishEvent(this.gameRelay, event).catch(error => {
            console.error(`[Nostr] Failed to publish quest event:`, error);
        });
    },
    
    // Publish chat message to explorer relay
    publishChatMessage: function(message) {
        if (typeof Player === 'undefined' || !Player.pubkey || !message) return false;
        
        // For chat, we publish to the active explorer relay
        if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
            console.error("[Nostr] No active explorer relay for chat");
            return false;
        }
        
        const relay = this.explorerRelays.get(this.activeExplorerRelay);
        
        const event = {
            kind: 9, // Using NIP-C7 for chat
            content: message,
            tags: [
                ["client", "relay-world"]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish to active explorer relay
        this.publishEvent(relay, event).catch(error => {
            console.error(`[Nostr] Failed to publish chat:`, error);
            if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
                UI.showToast("Failed to send message", "error");
            }
        });
        
        return true;
    },
    
    // Publish a direct message
    publishDirectMessage: async function(recipientPubkey, message) {
        if (typeof Player === 'undefined' || !Player.pubkey || !recipientPubkey || !message) return false;
        
        try {
            // Encrypt the message
            const encrypted = await this.encryptMessage(recipientPubkey, message);
            
            const event = {
                kind: 4,
                content: encrypted,
                tags: [['p', recipientPubkey]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: Player.pubkey
            };
            
            // Publish to active explorer relay
            if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
                console.error("[Nostr] No active explorer relay for direct messages");
                return false;
            }
            
            const relay = this.explorerRelays.get(this.activeExplorerRelay);
            await this.publishEvent(relay, event);
            
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to publish direct message:`, error);
            if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
                UI.showToast("Failed to send direct message", "error");
            }
            return false;
        }
    },
    
    // Encrypt a message using NIP-04
    encryptMessage: async function(recipientPubkey, message) {
        try {
            if (!window.nostr || !window.nostr.nip04) {
                throw new Error("NIP-04 not supported by extension");
            }
            
            return await window.nostr.nip04.encrypt(recipientPubkey, message);
        } catch (error) {
            console.error(`[Nostr] Failed to encrypt message:`, error);
            throw error;
        }
    },
    
    // Decrypt a message using NIP-04
    decryptMessage: async function(encryptedMessage, senderPubkey) {
        try {
            if (!window.nostr || !window.nostr.nip04) {
                throw new Error("NIP-04 not supported by extension");
            }
            
            return await window.nostr.nip04.decrypt(senderPubkey, encryptedMessage);
        } catch (error) {
            console.error(`[Nostr] Failed to decrypt message:`, error);
            throw error;
        }
    },
    
    // Publish weather event
    publishWeatherEvent: function(weatherType) {
        if (typeof Player === 'undefined' || !Player.pubkey || !this.gameRelay) return;
        
        const event = {
            kind: RelayWorld.config.EVENT_KINDS.WEATHER,
            content: JSON.stringify({ type: weatherType }),
            tags: [
                ["t", "weather"],
                ["t", "game"]
            ],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: Player.pubkey
        };
        
        // Publish to game relay
        this.publishEvent(this.gameRelay, event).catch(error => {
            console.error(`[Nostr] Failed to publish weather event:`, error);
        });
    },
    
    // Follow a user (publish to explorer relay)
    followUser: async function(pubkey) {
        if (typeof Player === 'undefined' || !Player.pubkey || !pubkey) return false;
        
        try {
            // Get current contacts
            const user = this.users.get(Player.pubkey);
            if (!user) return false;
            
            // Create a new Set with all current follows
            const follows = new Set(user.following);
            
            // Add the new pubkey
            follows.add(pubkey);
            
            // Create tag array for each followed pubkey
            const tags = Array.from(follows).map(pk => ['p', pk]);
            
            // Create event
            const event = {
                kind: 3,
                content: "",
                tags,
                created_at: Math.floor(Date.now() / 1000),
                pubkey: Player.pubkey
            };
            
            // Publish to active explorer relay
            if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
                console.error("[Nostr] No active explorer relay for following users");
                return false;
            }
            
            const relay = this.explorerRelays.get(this.activeExplorerRelay);
            await this.publishEvent(relay, event);
            
            // Update local state
            user.following = follows;
            
            // Add current player as follower to followed user
            if (this.users.has(pubkey)) {
                this.users.get(pubkey).followers.add(Player.pubkey);
            }
            
            // Update player stats
            if (typeof Player.follows !== 'undefined') {
                Player.follows++;
            }
            
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to follow user:`, error);
            return false;
        }
    },
    
    // Unfollow a user (publish to explorer relay)
    unfollowUser: async function(pubkey) {
        if (typeof Player === 'undefined' || !Player.pubkey || !pubkey) return false;
        
        try {
            // Get current contacts
            const user = this.users.get(Player.pubkey);
            if (!user) return false;
            
            // Create a new Set with all current follows
            const follows = new Set(user.following);
            
            // Remove the pubkey
            follows.delete(pubkey);
            
            // Create tag array for each followed pubkey
            const tags = Array.from(follows).map(pk => ['p', pk]);
            
            // Create event
            const event = {
                kind: 3,
                content: "",
                tags,
                created_at: Math.floor(Date.now() / 1000),
                pubkey: Player.pubkey
            };
            
            // Publish to active explorer relay
            if (!this.activeExplorerRelay || !this.explorerRelays.has(this.activeExplorerRelay)) {
                console.error("[Nostr] No active explorer relay for unfollowing users");
                return false;
            }
            
            const relay = this.explorerRelays.get(this.activeExplorerRelay);
            await this.publishEvent(relay, event);
            
            // Update local state
            user.following = follows;
            
            // Remove current player as follower from unfollowed user
            if (this.users.has(pubkey)) {
                this.users.get(pubkey).followers.delete(Player.pubkey);
            }
            
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to unfollow user:`, error);
            return false;
        }
    },
    
    // Check if current player is following a user
    isFollowing: function(pubkey) {
        if (typeof Player === 'undefined' || !Player.pubkey || !pubkey) return false;
        
        const user = this.users.get(Player.pubkey);
        if (!user) return false;
        
        return user.following.has(pubkey);
    },
    
    // Get a user by pubkey
    getUser: function(pubkey) {
        return this.users.get(pubkey);
    },
    
    // Get nearby users to player
    getNearbyUsers: function(range = 300) {
        const nearby = [];
        
        // Use RelayWorld config if available
        if (typeof RelayWorld !== 'undefined' && 
            RelayWorld.config && 
            RelayWorld.config.INTERACTION_RANGE) {
            range = RelayWorld.config.INTERACTION_RANGE;
        }
        
        if (typeof Player === 'undefined') return nearby;
        
        for (const [pubkey, user] of this.users) {
            if (pubkey === Player.pubkey) continue;
            
            const distance = Math.sqrt(
                Math.pow(Player.x - user.x, 2) + 
                Math.pow(Player.y - user.y, 2)
            );
            
            if (distance <= range) {
                nearby.push({
                    pubkey,
                    user,
                    distance
                });
            }
        }
        
        // Sort by distance
        nearby.sort((a, b) => a.distance - b.distance);
        
        return nearby;
    },
    
    // Load player profile
    loadPlayerProfile: async function() {
        try {
            if (typeof Player === 'undefined' || !Player.pubkey) {
                throw new Error("Player not initialized");
            }
            
            // Request profile from login relay
            if (!this.loginRelay) {
                throw new Error("Login relay not connected");
            }
            
            const filters = [{ kinds: [0], authors: [Player.pubkey], limit: 1 }];
            
            this.subscribe(this.loginRelay, filters, 
                (event) => this.processExplorerEvent(event, RelayWorld.config.LOGIN_RELAY),
                () => {} // EOSE handler
            );
            
            // Also request contacts
            const contactsFilters = [{ kinds: [3], authors: [Player.pubkey], limit: 1 }];
            
            this.subscribe(this.loginRelay, contactsFilters, 
                (event) => this.processExplorerEvent(event, RelayWorld.config.LOGIN_RELAY),
                () => {} // EOSE handler
            );
            
            // Wait a bit for events to come in
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return true;
        } catch (error) {
            console.error(`[Nostr] Failed to load player profile:`, error);
            throw error;
        }
    }
};

// Export Nostr as the default export
export default Nostr;
