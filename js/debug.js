/**
 * debug.js - Debug utilities for Relay World
 * Helps with troubleshooting and development
 */

const Debug = {
    // Debug panel element
    panel: null,
    
    // Debug settings
    enabled: true,
    logToConsole: true,
    showPanel: true,
    
    // Initialize debug system
    init: function() {
        if (!this.enabled) return;
        
        console.log("[Debug] Initializing debug system...");
        
        // Create debug panel
        this.createDebugPanel();
        
        // Add event listeners for toggling debug features
        document.addEventListener('keydown', (e) => {
            // Toggle debug panel with ~ key
            if (e.key === '`' || e.key === '~') {
                this.toggleDebugPanel();
            }
        });
        
        // Log initialization status
        this.log("Debug system initialized");
        
        // Monitor for errors
        this.setupErrorHandling();
        
        return true;
    },
    
    // Create debug panel
    createDebugPanel: function() {
        if (this.panel) return;
        
        this.panel = document.createElement('div');
        this.panel.id = 'debug-panel';
        this.panel.innerHTML = `
            <h3>Debug Panel</h3>
            <div id="debug-log"></div>
        `;
        
        document.body.appendChild(this.panel);
        
        if (!this.showPanel) {
            this.panel.style.display = 'none';
        }
    },
    
    // Toggle debug panel visibility
    toggleDebugPanel: function() {
        if (!this.panel) return;
        
        this.showPanel = !this.showPanel;
        this.panel.style.display = this.showPanel ? 'block' : 'none';
    },
    
    // Log a message
    log: function(message, type = 'info') {
        if (!this.enabled) return;
        
        // Format message
        const timestamp = new Date().toISOString().substring(11, 19);
        const formattedMessage = `[${timestamp}] ${message}`;
        
        // Log to console
        if (this.logToConsole) {
            switch (type) {
                case 'error':
                    console.error(formattedMessage);
                    break;
                case 'warn':
                    console.warn(formattedMessage);
                    break;
                case 'success':
                    console.log(`%c${formattedMessage}`, 'color: green');
                    break;
                default:
                    console.log(formattedMessage);
            }
        }
        
        // Add to debug panel
        if (this.panel) {
            const logElement = document.getElementById('debug-log');
            if (logElement) {
                const messageElement = document.createElement('div');
                messageElement.className = `debug-message debug-${type}`;
                messageElement.textContent = formattedMessage;
                
                // Add to panel
                logElement.insertBefore(messageElement, logElement.firstChild);
                
                // Limit the number of messages
                if (logElement.children.length > 50) {
                    logElement.removeChild(logElement.lastChild);
                }
            }
        }
    },
    
    // Check WebRTC support
    checkWebRTCSupport: function() {
        const supported = !!window.RTCPeerConnection;
        this.log(`WebRTC support: ${supported ? 'Yes' : 'No'}`);
        return supported;
    },
    
    // Check if Nostr extension is available
    checkNostrExtension: function() {
        const available = !!window.nostr;
        this.log(`Nostr extension: ${available ? 'Available' : 'Not available'}`);
        return available;
    },
    
    // Monitor for errors
    setupErrorHandling: function() {
        // Capture window errors
        window.addEventListener('error', (e) => {
            this.log(`Error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, 'error');
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.log(`Unhandled promise rejection: ${e.reason}`, 'error');
        });
        
        // Patch console.error
        const originalError = console.error;
        console.error = (...args) => {
            // Call original console.error
            originalError.apply(console, args);
            
            // Log to debug panel
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' ');
            
            // Add to debug panel without calling log again to avoid recursion
            if (this.panel) {
                const logElement = document.getElementById('debug-log');
                if (logElement) {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'debug-message debug-error';
                    messageElement.textContent = `[${new Date().toISOString().substring(11, 19)}] ${message}`;
                    
                    // Add to panel
                    logElement.insertBefore(messageElement, logElement.firstChild);
                }
            }
        };
    },
    
    // Run diagnostics
    runDiagnostics: function() {
        this.log("Running diagnostics...");
        
        // Check Nostr extension
        this.checkNostrExtension();
        
        // Check WebRTC support
        this.checkWebRTCSupport();
        
        // Check WebSocket support
        this.log(`WebSocket support: ${!!window.WebSocket ? 'Yes' : 'No'}`);
        
        // Check LocalStorage support
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            this.log('LocalStorage support: Yes');
        } catch (e) {
            this.log('LocalStorage support: No', 'error');
        }
        
        // Check modules
        this.log(`Utils module: ${typeof Utils !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Player module: ${typeof Player !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Items module: ${typeof Items !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Nostr module: ${typeof Nostr !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Zaps module: ${typeof Zaps !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Audio module: ${typeof Audio !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`UI module: ${typeof UI !== 'undefined' ? 'Available' : 'Missing'}`);
        this.log(`Game module: ${typeof Game !== 'undefined' ? 'Available' : 'Missing'}`);
        
        this.log("Diagnostics complete");
    },
    
    // Inspect a relay connection
    inspectRelay: function(relayUrl) {
        if (typeof Nostr === 'undefined' || !Nostr.relayConnections) {
            this.log("Nostr module not available", "error");
            return;
        }
        
        const relay = Nostr.relayConnections.get(relayUrl);
        if (!relay) {
            this.log(`Relay ${relayUrl} not found in connections`, "error");
            return;
        }
        
        this.log(`Inspecting relay: ${relayUrl}`);
        
        // Check if socket exists and is connected
        const hasSocket = !!relay.socket;
        const socketState = hasSocket ? relay.socket.readyState : 'no socket';
        const socketStateText = hasSocket ? 
            (relay.socket.readyState === WebSocket.OPEN ? 'OPEN' : 
            relay.socket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
            relay.socket.readyState === WebSocket.CLOSED ? 'CLOSED' :
            relay.socket.readyState === WebSocket.CLOSING ? 'CLOSING' : 'UNKNOWN') : 'N/A';
        
        this.log(`Socket: ${hasSocket ? 'Yes' : 'No'}`);
        this.log(`Socket state: ${socketStateText} (${socketState})`);
        
        // Check if methods exist
        this.log(`Has 'sub' method: ${typeof relay.sub === 'function' ? 'Yes' : 'No'}`);
        this.log(`Has 'publish' method: ${typeof relay.publish === 'function' ? 'Yes' : 'No'}`);
        this.log(`Has 'close' method: ${typeof relay.close === 'function' ? 'Yes' : 'No'}`);
    },
    
    // Test relay connection
    testRelay: async function(relayUrl) {
        this.log(`Testing relay connection: ${relayUrl}`);
        
        try {
            // Create a new WebSocket connection
            const ws = new WebSocket(relayUrl);
            
            // Set up promise to handle connection
            const connectionPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Connection to ${relayUrl} timed out`));
                }, 5000);
                
                ws.onopen = () => {
                    clearTimeout(timeoutId);
                    resolve(ws);
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                };
            });
            
            // Wait for connection
            await connectionPromise;
            
            this.log(`Successfully connected to ${relayUrl}`, "success");
            
            // Send a test message (REQ for basic info)
            const testSubId = `test-${Math.random().toString(36).substring(2, 10)}`;
            ws.send(JSON.stringify(["REQ", testSubId, { "limit": 1 }]));
            
            // Wait for response
            const responsePromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`No response from ${relayUrl} within timeout`));
                }, 5000);
                
                ws.onmessage = (event) => {
                    clearTimeout(timeoutId);
                    resolve(event.data);
                };
            });
            
            const response = await responsePromise;
            this.log(`Received response from ${relayUrl}`, "success");
            this.log(`Response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
            
            // Close the connection
            ws.close();
            
            return true;
        } catch (error) {
            this.log(`Test failed for ${relayUrl}: ${error.message}`, "error");
            return false;
        }
    },
    
    // Test websocket implementation
    testWebSocket: function() {
        try {
            const socket = new WebSocket('wss://relay.damus.io');
            
            this.log("WebSocket created successfully", "success");
            
            socket.onopen = () => {
                this.log("WebSocket connected successfully", "success");
                socket.close();
            };
            
            socket.onerror = (error) => {
                this.log(`WebSocket error: ${error}`, "error");
            };
            
            socket.onclose = () => {
                this.log("WebSocket closed", "info");
            };
            
            return true;
        } catch (error) {
            this.log(`WebSocket test failed: ${error.message}`, "error");
            return false;
        }
    },
    
    // Check for common issues
    checkForIssues: function() {
        this.log("Checking for common issues...");
        
        // Check if NostrTools is loaded
        if (!window.NostrTools) {
            this.log("NostrTools library not found. This could cause issues with relay connections.", "warn");
        }
        
        // Check if SimplePeer is loaded (for WebRTC)
        if (!window.SimplePeer) {
            this.log("SimplePeer library not found. Voice chat will not work.", "warn");
        }
        
        // Check if BitcoinConnect is loaded
        if (!window.BitcoinConnect) {
            this.log("BitcoinConnect library not found. Zaps functionality will be limited.", "warn");
        }
        
        // Check if Nostr extension is available
        if (!window.nostr) {
            this.log("Nostr extension not found. Login and publishing will not work.", "error");
        } else {
            // Check NIP-04 support
            if (!window.nostr.nip04) {
                this.log("NIP-04 not supported by extension. Direct messages will not work.", "warn");
            }
            
            // Check if getPublicKey is available
            if (typeof window.nostr.getPublicKey !== 'function') {
                this.log("getPublicKey not available in Nostr extension. Login will fail.", "error");
            }
            
            // Check if signEvent is available
            if (typeof window.nostr.signEvent !== 'function') {
                this.log("signEvent not available in Nostr extension. Publishing events will fail.", "error");
            }
        }
        
        // Check for audio issues
        if (typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined') {
            this.log("AudioContext not supported. Sound effects will not work.", "warn");
        }
        
        this.log("Issue check complete");
    },
    
    // Fix common issues
    fixCommonIssues: function() {
        this.log("Attempting to fix common issues...");
        
        // Fix for relay.sub is not a function
        if (typeof Nostr !== 'undefined') {
            const originalConnect = Nostr.connectRelay;
            
            Nostr.connectRelay = async function(url) {
                try {
                    const relay = await originalConnect.call(this, url);
                    
                    // Ensure sub method exists
                    if (!relay.sub || typeof relay.sub !== 'function') {
                        Debug.log(`Fixing missing 'sub' method for ${url}`, "info");
                        
                        relay.sub = (filters, options = {}) => {
                            return this.createSubscription(relay, filters, options);
                        };
                    }
                    
                    return relay;
                } catch (error) {
                    Debug.log(`Could not fix relay connection for ${url}: ${error.message}`, "error");
                    throw error;
                }
            };
            
            this.log("Applied fix for relay.sub issue", "success");
        } else {
            this.log("Nostr module not found, could not apply fixes", "error");
        }
        
        this.log("Fixes applied");
    },
    
    // Add useful debugging methods to global scope
    addGlobalDebugMethods: function() {
        // Add to window for console access
        window.debugNostr = {
            getUsers: () => Nostr?.users || new Map(),
            getRelays: () => Nostr?.relays || new Set(),
            getConnections: () => Nostr?.relayConnections || new Map(),
            getSubscriptions: () => Nostr?.subscriptions || new Map(),
            testRelay: (url) => Debug.testRelay(url),
            inspectRelay: (url) => Debug.inspectRelay(url),
            diagnose: () => Debug.runDiagnostics(),
            fixIssues: () => Debug.fixCommonIssues()
        };
        
        this.log("Added global debug methods. Access via window.debugNostr", "success");
    }
};

// Initialize debug system when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    Debug.init();
    Debug.addGlobalDebugMethods();
});
