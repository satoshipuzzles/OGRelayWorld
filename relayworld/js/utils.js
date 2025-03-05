/**
 * utils.js - Utility functions for Relay World
 * Contains helper functions, formatters, and common utilities
 */

const Utils = {
    // Initialization
    init: function() {
        console.log("[Utils] Initializing utilities...");
        
        // Setup polyfills
        this.setupPolyfills();
        
        console.log("[Utils] Utilities initialized");
        return true;
    },
    
    // Setup any required polyfills
    setupPolyfills: function() {
        // Add any required polyfills here
    },
    
    // Format Nostr pubkey for display (npub or shortened hex)
    formatPubkey: function(pubkey, options = {}) {
        if (!pubkey) return "unknown";
        
        const { short = true, useNpub = true } = options;
        
        if (useNpub) {
            try {
                // Try to convert to npub
                if (window.NostrTools && window.NostrTools.nip19) {
                    const npub = window.NostrTools.nip19.npubEncode(pubkey);
                    if (short) {
                        return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
                    }
                    return npub;
                }
            } catch (e) {
                console.error("[Utils] Failed to convert pubkey to npub:", e);
            }
        }
        
        // Fallback to hex format
        if (short) {
            return `${pubkey.substring(0, 8)}...`;
        }
        
        return pubkey;
    },
    
    // Format a date timestamp
    formatDate: function(timestamp, options = {}) {
        const { format = "relative" } = options;
        const date = new Date(timestamp * 1000);
        
        if (format === "relative") {
            return this.timeAgo(date);
        } else if (format === "time") {
            return date.toLocaleTimeString();
        } else if (format === "datetime") {
            return date.toLocaleString();
        } else if (format === "date") {
            return date.toLocaleDateString();
        }
        
        return date.toISOString();
    },
    
    // Format time ago (relative time)
    timeAgo: function(date) {
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) {
            return "just now";
        }
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes}m ago`;
        }
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h ago`;
        }
        
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return `${days}d ago`;
        }
        
        const weeks = Math.floor(days / 7);
        if (weeks < 4) {
            return `${weeks}w ago`;
        }
        
        const months = Math.floor(days / 30);
        if (months < 12) {
            return `${months}mo ago`;
        }
        
        const years = Math.floor(days / 365);
        return `${years}y ago`;
    },
    
    // Format a number with commas
    formatNumber: function(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    
    // Format currency (sats)
    formatSats: function(sats) {
        return `${this.formatNumber(sats)} sats`;
    },
    
    // Convert hex to RGB
    hexToRgb: function(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    // Generate a random color
    randomColor: function() {
        return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    },
    
    // Generate a random ID
    randomId: function(prefix = '') {
        return `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    },
    
    // Calculate distance between two points
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    // Check if a point is within a rectangle
    pointInRect: function(x, y, rect) {
        return x >= rect.x && 
               x <= rect.x + rect.width &&
               y >= rect.y &&
               y <= rect.y + rect.height;
    },
    
    // Deep clone an object
    deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Sanitize HTML to prevent XSS
    sanitizeHTML: function(text) {
        const element = document.createElement('div');
        element.textContent = text;
        return element.innerHTML;
    },
    
    // Parse URL parameters
    parseUrlParams: function() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        }
        
        return params;
    },
    
    // Sleep function (for async/await)
    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Debounce function to limit how often a function can be called
    debounce: function(func, wait) {
        let timeout;
        
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    },
    
    // Throttle function to limit how often a function can be called
    throttle: function(func, limit) {
        let inThrottle;
        
        return function(...args) {
            const context = this;
            
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    },
    
    // Utility for handling async operations with timeouts
    withTimeout: function(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    },
    
    // Log with timestamp
    log: function(message, type = 'info') {
        const timestamp = new Date().toISOString();
        
        switch (type) {
            case 'error':
                console.error(`[${timestamp}] ${message}`);
                break;
            case 'warn':
                console.warn(`[${timestamp}] ${message}`);
                break;
            case 'success':
                console.log(`[${timestamp}] %c${message}`, 'color: green');
                break;
            default:
                console.log(`[${timestamp}] ${message}`);
        }
    },
    
    // Automatically add 'https://' to URLs if missing
    ensureHttps: function(url) {
        if (!url) return url;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    },
    
    // Fix avatar URLs (ensure they're valid)
    fixAvatarUrl: function(url) {
        if (!url) return 'assets/icons/default-avatar.png';
        
        try {
            // Ensure it's a valid URL
            const fixedUrl = this.ensureHttps(url);
            new URL(fixedUrl);
            return fixedUrl;
        } catch (e) {
            return 'assets/icons/default-avatar.png';
        }
    }
};

// Export Utils as the default export
export default Utils;
