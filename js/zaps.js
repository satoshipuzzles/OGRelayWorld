/**
 * zaps.js - NIP-57 Zaps integration for Relay World
 * Handles wallet connections, sending/receiving zaps, and zap-related UI
 */

const Zaps = {
    // Wallet connection state
    webln: null, // WebLN connection if available
    nwcConnection: null, // NWC connection details
    isConnected: false,
    initialized: false,
    
    // Recent zaps
    recentZaps: [], // Array of recent zaps sent/received
    zapsReceived: 0, // Total number of zaps received
    zapsSent: 0, // Total number of zaps sent
    
    // Initialize zaps system
    init: function() {
        console.log("[Zaps] Initializing zaps system...");
        
        // Check if the user is logged in before initializing
        if (!Player.pubkey) {
            console.log("[Zaps] Deferring zaps initialization until user logs in");
            return;
        }
        
        // Setup UI event listeners
        this.setupEventListeners();
        
        // Set up Bitcoin Connect event listeners
        this.setupBitcoinConnect();
        
        // Check for existing WebLN provider
        this.checkWebLNProvider()
            .then(connected => {
                if (connected) {
                    console.log("[Zaps] WebLN provider automatically connected");
                    UI.showToast("Lightning wallet connected", "success");
                }
            })
            .catch(err => {
                console.error("[Zaps] Error checking WebLN provider:", err);
            });
        
        this.initialized = true;
        console.log("[Zaps] Zaps system initialized");
    },
    
    // Initialize zaps system after login
    initAfterLogin: function() {
        if (this.initialized) return;
        
        console.log("[Zaps] Initializing zaps system after login...");
        
        // Setup UI event listeners
        this.setupEventListeners();
        
        // Set up Bitcoin Connect event listeners
        this.setupBitcoinConnect();
        
        // Check for existing WebLN provider
        this.checkWebLNProvider()
            .then(connected => {
                if (connected) {
                    console.log("[Zaps] WebLN provider automatically connected");
                    UI.showToast("Lightning wallet connected", "success");
                }
            })
            .catch(err => {
                console.error("[Zaps] Error checking WebLN provider:", err);
            });
        
        this.initialized = true;
        console.log("[Zaps] Zaps system initialized after login");
    },
    
    // Set up Bitcoin Connect UI
    setupBitcoinConnect: function() {
        // Set up Bitcoin Connect modal
        const modal = document.getElementById('bitcoin-connect-modal');
        const closeBtn = document.getElementById('bc-modal-close');
        
        if (!modal || !closeBtn) {
            console.error("[Zaps] Bitcoin Connect modal elements not found");
            return;
        }
        
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hide');
        });
        
        // Set up connector click handlers
        const connectors = document.querySelectorAll('.bc-connector');
        
        connectors.forEach(connector => {
            connector.addEventListener('click', async () => {
                const type = connector.dataset.connector;
                
                try {
                    switch (type) {
                        case 'nwc':
                            await this.connectWithNWC();
                            break;
                        case 'alby':
                            await this.connectWithAlby();
                            break;
                        case 'webln':
                            await this.connectWithWebLN();
                            break;
                    }
                    
                    // Hide modal if connection successful
                    modal.classList.add('hide');
                    
                } catch (error) {
                    console.error(`[Zaps] Failed to connect with ${type}:`, error);
                    UI.showToast(`Failed to connect: ${error.message}`, "error");
                }
            });
        });
    },
    
    // Set up UI event listeners
    setupEventListeners: function() {
        // Zap interface event listeners
        const zapClose = document.getElementById('zap-close');
        const zapSendButton = document.getElementById('zap-send-button');
        const zapPresets = document.querySelectorAll('.zap-preset');
        
        if (zapClose) {
            zapClose.addEventListener('click', () => {
                document.getElementById('zap-interface').classList.add('hide');
            });
        }
        
        if (zapSendButton) {
            zapSendButton.addEventListener('click', () => {
                this.sendZap();
            });
        }
        
        if (zapPresets) {
            zapPresets.forEach(preset => {
                preset.addEventListener('click', () => {
                    const amount = preset.dataset.amount;
                    document.getElementById('zap-amount').value = amount;
                    
                    // Remove active class from all presets
                    zapPresets.forEach(p => p.classList.remove('active'));
                    
                    // Add active class to clicked preset
                    preset.classList.add('active');
                });
            });
        }
    },
    
    // Check for existing WebLN provider
    checkWebLNProvider: async function() {
        try {
            if (window.webln) {
                // WebLN provider found
                await window.webln.enable();
                this.webln = window.webln;
                this.isConnected = true;
                
                console.log("[Zaps] WebLN provider found and enabled");
                return true;
            }
        } catch (error) {
            console.error("[Zaps] Failed to enable WebLN:", error);
        }
        
        return false;
    },
    
    // Connect with NWC (Nostr Wallet Connect)
    connectWithNWC: async function() {
        try {
            if (!window.BitcoinConnect) {
                throw new Error("Bitcoin Connect library not found");
            }
            
            // In a real implementation, this would open a flow to scan/enter an NWC URI
            // Here we're using a simplified mock flow
            
            // Show input prompt for NWC URI
            const nwcUri = prompt("Enter your NWC URI (nostr+walletconnect://...)");
            
            if (!nwcUri || !nwcUri.startsWith('nostr+walletconnect://')) {
                throw new Error("Invalid NWC URI");
            }
            
            // Parse NWC URI to get connection details
            const parsedUri = this.parseNwcUri(nwcUri);
            
            // Store connection details
            this.nwcConnection = parsedUri;
            
            // Create WebLN provider from NWC connection
            await this.createNwcProvider();
            
            UI.showToast("Connected to wallet via NWC", "success");
            this.isConnected = true;
            
            return true;
        } catch (error) {
            console.error("[Zaps] Failed to connect with NWC:", error);
            UI.showToast(`NWC connection failed: ${error.message}`, "error");
            
            return false;
        }
    },
    
    // Parse NWC URI
    parseNwcUri: function(uri) {
        try {
            // Remove protocol prefix
            const withoutPrefix = uri.replace('nostr+walletconnect://', '');
            
            // Split pubkey and query params
            const [pubkey, queryString] = withoutPrefix.split('?');
            
            // Parse query params
            const params = new URLSearchParams(queryString);
            
            return {
                pubkey,
                relay: params.get('relay'),
                secret: params.get('secret'),
                lud16: params.get('lud16')
            };
        } catch (error) {
            console.error("[Zaps] Failed to parse NWC URI:", error);
            throw new Error("Invalid NWC URI format");
        }
    },
    
    // Create WebLN provider from NWC connection
    createNwcProvider: async function() {
        if (!this.nwcConnection) return false;
        
        try {
            // In a real implementation, this would create a WebLN provider
            // that communicates with the wallet via Nostr messages
            
            // For this demo, we'll create a mock WebLN provider
            this.webln = {
                enabled: true,
                
                // Get info about the connected wallet
                getInfo: async () => {
                    return {
                        alias: "NWC Wallet",
                        color: "#9945FF",
                        pubkey: this.nwcConnection.pubkey,
                        methods: ["makeInvoice", "sendPayment"]
                    };
                },
                
                // Create a lightning invoice
                makeInvoice: async (args) => {
                    const { amount, defaultMemo } = args;
                    
                    // In a real implementation, this would send a request to the wallet
                    // via Nostr to create an invoice
                    
                    // For this demo, we'll just return a mock invoice
                    return {
                        paymentRequest: `lnbcrt${amount}p1...mock_invoice...`,
                        paymentHash: `mock_payment_hash_${Date.now()}`,
                        preimage: `mock_preimage_${Date.now()}`
                    };
                },
                
                // Send a payment to a lightning invoice
                sendPayment: async (paymentRequest) => {
                    // In a real implementation, this would send a request to the wallet
                    // via Nostr to pay the invoice
                    
                    // For this demo, we'll just return a mock payment result
                    return {
                        preimage: `mock_preimage_${Date.now()}`,
                        paymentHash: `mock_payment_hash_${Date.now()}`
                    };
                }
            };
            
            console.log("[Zaps] Created NWC WebLN provider");
            return true;
            
        } catch (error) {
            console.error("[Zaps] Failed to create NWC provider:", error);
            throw error;
        }
    },
    
    // Connect with Alby extension
    connectWithAlby: async function() {
        try {
            if (!window.alby) {
                throw new Error("Alby extension not found");
            }
            
            // Enable Alby
            await window.alby.enable();
            
            // Use Alby as WebLN provider
            this.webln = window.alby;
            this.isConnected = true;
            
            UI.showToast("Connected to Alby wallet", "success");
            
            return true;
        } catch (error) {
            console.error("[Zaps] Failed to connect with Alby:", error);
            UI.showToast(`Alby connection failed: ${error.message}`, "error");
            
            return false;
        }
    },
    
    // Connect with any WebLN provider
    connectWithWebLN: async function() {
        try {
            // Check if WebLN is available
            if (!window.webln) {
                throw new Error("No WebLN provider found");
            }
            
            // Enable WebLN
            await window.webln.enable();
            
            // Use provider
            this.webln = window.webln;
            this.isConnected = true;
            
            UI.showToast("Connected to Lightning wallet", "success");
            
            return true;
        } catch (error) {
            console.error("[Zaps] Failed to connect with WebLN:", error);
            UI.showToast(`WebLN connection failed: ${error.message}`, "error");
            
            return false;
        }
    },
    
    // Show zap interface for a user
    showZapInterface: function(pubkey) {
        const user = Nostr.getUser(pubkey);
        if (!user) {
            UI.showToast("User not found", "error");
            return;
        }
        
        // Check if we have a lightning wallet connected
        if (!this.isConnected && !this.checkWebLNProvider()) {
            UI.showToast("Please connect a lightning wallet first", "info");
            
            // Show Bitcoin Connect modal
            if (document.getElementById('bitcoin-connect-modal')) {
                document.getElementById('bitcoin-connect-modal').classList.remove('hide');
                
                // Update modal title to make it clearer
                constmodalTitle = document.getElementById('bc-modal-title');
                if (modalTitle) {
                    modalTitle.textContent = "Connect Lightning Wallet to Send Zaps";
                }
            } else {
                UI.showToast("Bitcoin Connect modal not found", "error");
            }
            return;
        }
        
        // Update zap interface with user info
        const zapInterface = document.getElementById('zap-interface');
        if (!zapInterface) {
            UI.showToast("Zap interface not found", "error");
            return;
        }
        
        const userImage = document.getElementById('zap-target-image');
        const userName = document.getElementById('zap-target-name');
        
        userImage.src = user.profile?.picture || "assets/icons/default-avatar.png";
        userName.textContent = user.profile?.name || user.pubkey.slice(0, 8);
        
        // Set default amount
        document.getElementById('zap-amount').value = "21";
        document.getElementById('zap-message').value = "";
        
        // Reset preset buttons
        document.querySelectorAll('.zap-preset').forEach(preset => {
            preset.classList.remove('active');
        });
        document.querySelector('.zap-preset[data-amount="21"]').classList.add('active');
        
        // Store target pubkey
        zapInterface.dataset.targetPubkey = pubkey;
        
        // Show interface
        zapInterface.classList.remove('hide');
    },
    
    // Send a zap to a user
    sendZap: async function() {
        const zapInterface = document.getElementById('zap-interface');
        const targetPubkey = zapInterface.dataset.targetPubkey;
        
        if (!targetPubkey) {
            UI.showToast("No zap target selected", "error");
            return;
        }
        
        const user = Nostr.getUser(targetPubkey);
        if (!user) {
            UI.showToast("User not found", "error");
            return;
        }
        
        // Check for lightning address (lud16) or lnurl in user profile
        const lightningAddress = user.profile?.lud16;
        if (!lightningAddress) {
            UI.showToast("User doesn't have a lightning address", "error");
            return;
        }
        
        // Get zap amount and message
        const amount = parseInt(document.getElementById('zap-amount').value);
        const message = document.getElementById('zap-message').value;
        
        if (isNaN(amount) || amount <= 0) {
            UI.showToast("Invalid zap amount", "error");
            return;
        }
        
        try {
            // Show loading state
            document.getElementById('zap-send-button').disabled = true;
            document.getElementById('zap-send-button').textContent = "Sending...";
            
            // Create a zap request (NIP-57)
            const zapRequest = await this.createZapRequest(targetPubkey, amount, message);
            
            // Get LNURL pay info
            const lnurlInfo = await this.getLnurlInfo(lightningAddress);
            
            // Check if the wallet supports zaps
            if (!lnurlInfo.allowsNostr || !lnurlInfo.nostrPubkey) {
                UI.showToast("User's wallet doesn't support zaps", "error");
                
                // Fallback to regular lightning payment
                await this.sendRegularPayment(lightningAddress, amount, message);
            } else {
                // Send zap
                await this.sendZapPayment(lnurlInfo, zapRequest);
            }
            
            // Track zap sent
            this.zapsSent++;
            this.recentZaps.push({
                type: 'sent',
                pubkey: targetPubkey,
                amount,
                message,
                timestamp: Date.now()
            });
            
            // Trim recent zaps list
            if (this.recentZaps.length > 20) {
                this.recentZaps.shift();
            }
            
            // Show success message
            UI.showToast(`Zapped ${user.profile?.name || targetPubkey.slice(0, 8)} ${amount} sats!`, "success");
            
            // Create zap effect
            this.createZapEffect(user.x, user.y);
            
            // Update player stats
            Player.score += Math.floor(amount / 10); // 10% of zap amount as score
            Nostr.publishScoreEvent();
            UI.updatePlayerProfile();
            
            // Hide zap interface
            zapInterface.classList.add('hide');
            
        } catch (error) {
            console.error("[Zaps] Failed to send zap:", error);
            UI.showToast(`Zap failed: ${error.message}`, "error");
        } finally {
            // Reset button state
            document.getElementById('zap-send-button').disabled = false;
            document.getElementById('zap-send-button').textContent = "Send Zap";
        }
    },
    
    // Create a zap request (NIP-57)
    createZapRequest: async function(recipientPubkey, amount, comment) {
        try {
            // Create zap request event (kind 9734)
            const zapRequestEvent = {
                kind: 9734,
                content: comment || "",
                tags: [
                    ["p", recipientPubkey],
                    ["amount", (amount * 1000).toString()], // Convert to millisats
                    ["relays", ...Array.from(Nostr.relays)],
                ],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: Player.pubkey
            };
            
            // Sign the event
            const signedEvent = await Nostr.signEvent(zapRequestEvent);
            
            return signedEvent;
        } catch (error) {
            console.error("[Zaps] Failed to create zap request:", error);
            throw error;
        }
    },
    
    // Get LNURL pay info from a lightning address
    getLnurlInfo: async function(lightningAddress) {
        try {
            // Parse lightning address
            const [name, domain] = lightningAddress.split('@');
            
            // Fetch LNURL info
            const response = await fetch(`https://${domain}/.well-known/lnurlp/${name}`);
            const data = await response.json();
            
            return {
                callback: data.callback,
                minSendable: data.minSendable,
                maxSendable: data.maxSendable,
                nostrPubkey: data.nostrPubkey,
                allowsNostr: data.allowsNostr || false
            };
        } catch (error) {
            console.error("[Zaps] Failed to get LNURL info:", error);
            throw new Error("Failed to get lightning address info");
        }
    },
    
    // Send a zap payment using NIP-57
    sendZapPayment: async function(lnurlInfo, zapRequest) {
        try {
            if (!this.webln) {
                throw new Error("No WebLN provider available");
            }
            
            // Amount in millisats
            const amount = parseInt(zapRequest.tags.find(t => t[0] === "amount")[1]);
            
            // Check against min/max
            if (amount < lnurlInfo.minSendable) {
                throw new Error(`Amount too small. Minimum is ${lnurlInfo.minSendable / 1000} sats.`);
            }
            
            if (amount > lnurlInfo.maxSendable) {
                throw new Error(`Amount too large. Maximum is ${lnurlInfo.maxSendable / 1000} sats.`);
            }
            
            // Encode zap request as JSON and encode for URL
            const encodedZapRequest = encodeURIComponent(JSON.stringify(zapRequest));
            
            // Create callback URL with zap request
            const callbackUrl = `${lnurlInfo.callback}?amount=${amount}&nostr=${encodedZapRequest}`;
            
            // Fetch invoice
            const response = await fetch(callbackUrl);
            const data = await response.json();
            
            if (!data.pr) {
                throw new Error("No invoice received from lightning provider");
            }
            
            // Pay invoice
            const result = await this.webln.sendPayment(data.pr);
            
            console.log("[Zaps] Zap payment sent:", result);
            return result;
            
        } catch (error) {
            console.error("[Zaps] Failed to send zap payment:", error);
            throw error;
        }
    },
    
    // Send a regular lightning payment (non-zap)
    sendRegularPayment: async function(lightningAddress, amount, message) {
        try {
            if (!this.webln) {
                throw new Error("No WebLN provider available");
            }
            
            // Parse lightning address
            const [name, domain] = lightningAddress.split('@');
            
            // Fetch LNURL info
            const response = await fetch(`https://${domain}/.well-known/lnurlp/${name}`);
            const data = await response.json();
            
            // Amount in millisats
            const millisats = amount * 1000;
            
            // Check against min/max
            if (millisats < data.minSendable) {
                throw new Error(`Amount too small. Minimum is ${data.minSendable / 1000} sats.`);
            }
            
            if (millisats > data.maxSendable) {
                throw new Error(`Amount too large. Maximum is ${data.maxSendable / 1000} sats.`);
            }
            
            // Create callback URL
            let callbackUrl = `${data.callback}?amount=${millisats}`;
            
            // Add comment if provided
            if (message && data.commentAllowed && message.length <= data.commentAllowed) {
                callbackUrl += `&comment=${encodeURIComponent(message)}`;
            }
            
            // Fetch invoice
            const invoiceResponse = await fetch(callbackUrl);
            const invoiceData = await invoiceResponse.json();
            
            if (!invoiceData.pr) {
                throw new Error("No invoice received from lightning provider");
            }
            
            // Pay invoice
            const result = await this.webln.sendPayment(invoiceData.pr);
            
            console.log("[Zaps] Lightning payment sent:", result);
            return result;
            
        } catch (error) {
            console.error("[Zaps] Failed to send lightning payment:", error);
            throw error;
        }
    },
    
    // Handle receiving a zap
    handleZapReceipt: function(zapReceipt) {
        try {
            // Parse zap receipt (kind 9735)
            const zapEvent = zapReceipt;
            
            // Get amount from BOLT11 invoice
            const bolt11 = zapEvent.tags.find(t => t[0] === "bolt11")[1];
            // In a real implementation, we would decode the BOLT11 invoice to get the amount
            // For this demo we'll use a mock amount
            const amount = 21; // Mock amount
            
            // Get sender pubkey
            const senderTag = zapEvent.tags.find(t => t[0] === "p");
            const senderPubkey = senderTag ? senderTag[1] : null;
            
            if (!senderPubkey) return;
            
            // Find description tag
            const descriptionTag = zapEvent.tags.find(t => t[0] === "description");
            
            // Parse description (contains original zap request)
            let zapRequest = null;
            let comment = "";
            
            if (descriptionTag) {
                try {
                    zapRequest = JSON.parse(descriptionTag[1]);
                    comment = zapRequest.content;
                } catch (e) {
                    console.error("[Zaps] Failed to parse zap request:", e);
                }
            }
            
            // Track zap received
            this.zapsReceived++;
            this.recentZaps.push({
                type: 'received',
                pubkey: senderPubkey,
                amount,
                message: comment,
                timestamp: Date.now()
            });
            
            // Trim recent zaps list
            if (this.recentZaps.length > 20) {
                this.recentZaps.shift();
            }
            
            // Update player stats
            Player.score += amount;
            Nostr.publishScoreEvent();
            UI.updatePlayerProfile();
            
            // Show notification
            const sender = Nostr.getUser(senderPubkey);
            const senderName = sender?.profile?.name || senderPubkey.slice(0, 8);
            
            UI.showToast(`Received ${amount} sats zap from ${senderName}!`, "success");
            
            // Create zap effect on player
            this.createZapEffect(Player.x, Player.y);
            
        } catch (error) {
            console.error("[Zaps] Failed to handle zap receipt:", error);
        }
    },
    
    // Create visual zap effect
    createZapEffect: function(x, y) {
        // Create zap effect element
        const effect = document.createElement('div');
        effect.className = 'zap-effect';
        
        // Position at target coordinates
        const screenX = x - (Game.camera.x - Game.canvas.width / 2);
        const screenY = y - (Game.camera.y - Game.canvas.height / 2);
        
        effect.style.left = `${screenX - 50}px`;
        effect.style.top = `${screenY - 50}px`;
        
        // Add to game container
        document.getElementById('game-container').appendChild(effect);
        
        // Play sound
        UI.playSound("zap");
        
        // Remove after animation completes
        setTimeout(() => {
            effect.remove();
        }, 500);
    },
    
    // Get recent zaps for a user
    getZapsForUser: function(pubkey) {
        return this.recentZaps.filter(zap => 
            (zap.type === 'sent' && zap.pubkey === pubkey) ||
            (zap.type === 'received' && zap.pubkey === pubkey)
        );
    },
    
    // Get leaderboard by zaps sent/received
    getZapLeaderboard: function() {
        const zapsByUser = new Map();
        
        // Count zaps sent/received for all users
        for (const zap of this.recentZaps) {
            const pubkey = zap.pubkey;
            
            if (!zapsByUser.has(pubkey)) {
                zapsByUser.set(pubkey, { sent: 0, received: 0, total: 0 });
            }
            
            const userZaps = zapsByUser.get(pubkey);
            
            if (zap.type === 'sent') {
                userZaps.sent += zap.amount;
            } else {
                userZaps.received += zap.amount;
            }
            
            userZaps.total = userZaps.sent + userZaps.received;
        }
        
        // Convert to array and sort by total zaps
        const leaderboard = Array.from(zapsByUser.entries())
            .map(([pubkey, zaps]) => ({
                pubkey,
                ...zaps,
                user: Nostr.getUser(pubkey)
            }))
            .sort((a, b) => b.total - a.total);
        
        return leaderboard;
    }
};
