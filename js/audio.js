/**
 * audio.js - WebRTC proximity voice chat for Relay World
 * Handles peer connections, audio streaming, and spatial audio
 */

const Audio = {
    // WebRTC connections
    isVoiceChatActive: false,
    localStream: null,
    peers: new Map(), // Map of pubkey -> peer connection
    nearbyUsers: new Map(), // Map of pubkey -> {distance, lastUpdate, speaking}
    audioContext: null,
    audioAnalyser: null,
    
    // Voice detection
    isSpeaking: false,
    speakingThreshold: 30, // Threshold for speaking detection
    silenceTimer: null,
    
    // Initialize audio system
    init: function() {
        // Create WebRTC peers when users come into range
        
        // Set up voice button event
        document.getElementById('voice-toggle').addEventListener('click', this.toggleVoiceChat.bind(this));
        
        // Check if browser supports WebRTC
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("[Audio] Browser does not support WebRTC");
            document.getElementById('voice-toggle').style.display = 'none';
            return false;
        }
        
        // Set up audio context (for analyzing audio levels)
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("[Audio] Failed to create AudioContext:", e);
        }
        
        console.log("[Audio] Audio system initialized");
        return true;
    },
    
    // Toggle voice chat on/off
    toggleVoiceChat: async function() {
        if (this.isVoiceChatActive) {
            this.stopVoiceChat();
        } else {
            await this.startVoiceChat();
        }
    },
    
    // Start voice chat
    startVoiceChat: async function() {
        try {
            console.log("[Audio] Starting voice chat...");
            
            // Request microphone access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            // Set up audio analysis for voice detection
            this.setupVoiceDetection();
            
            // Update UI
            this.isVoiceChatActive = true;
            document.getElementById('voice-icon').textContent = '🔊';
            document.getElementById('voice-indicator').classList.add('active');
            
            // Connect to nearby users
            this.connectToNearbyUsers();
            
            // Show notification
            UI.showToast("Voice chat activated - nearby players can hear you", "success");
            
            return true;
        } catch (error) {
            console.error("[Audio] Failed to start voice chat:", error);
            this.isVoiceChatActive = false;
            
            // Show notification
            UI.showToast("Failed to start voice chat: " + error.message, "error");
            
            return false;
        }
    },
    
    // Stop voice chat
    stopVoiceChat: function() {
        console.log("[Audio] Stopping voice chat...");
        
        // Stop all peer connections
        for (const [pubkey, peer] of this.peers) {
            peer.destroy();
        }
        this.peers.clear();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Clear audio analysis
        if (this.audioAnalyser) {
            this.audioAnalyser = null;
        }
        
        // Update UI
        this.isVoiceChatActive = false;
        document.getElementById('voice-icon').textContent = '🎙️';
        document.getElementById('voice-indicator').classList.remove('active');
        
        // Update voice indicators
        const indicators = document.getElementById('voice-chat-indicators');
        indicators.innerHTML = '';
        
        // Show notification
        UI.showToast("Voice chat deactivated", "info");
    },
    
    // Set up voice activity detection
    setupVoiceDetection: function() {
        if (!this.audioContext || !this.localStream) return;
        
        try {
            // Create audio source from stream
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            
            // Create analyser node
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            
            // Connect source to analyser
            source.connect(this.audioAnalyser);
            
            // Start monitoring voice activity
            this.monitorVoiceActivity();
            
        } catch (error) {
            console.error("[Audio] Failed to set up voice detection:", error);
        }
    },
    
    // Monitor voice activity
    monitorVoiceActivity: function() {
        if (!this.audioAnalyser) return;
        
        const bufferLength = this.audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkVoiceActivity = () => {
            if (!this.isVoiceChatActive || !this.audioAnalyser) return;
            
            // Get volume data
            this.audioAnalyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Check if speaking
            const wasSpeaking = this.isSpeaking;
            this.isSpeaking = average > this.speakingThreshold;
            
            // Handle state change
            if (this.isSpeaking !== wasSpeaking) {
                if (this.isSpeaking) {
                    // Started speaking
                    clearTimeout(this.silenceTimer);
                    document.getElementById('voice-indicator').style.backgroundColor = '#10B981';
                } else {
                    // Stopped speaking - add a small delay to prevent flicker
                    this.silenceTimer = setTimeout(() => {
                        if (this.isVoiceChatActive) {
                            document.getElementById('voice-indicator').style.backgroundColor = '#555';
                        }
                    }, 500);
                }
            }
            
            // Continue monitoring
            requestAnimationFrame(checkVoiceActivity);
        };
        
        checkVoiceActivity();
    },
    
    // Check if local user is speaking
    isLocalUserSpeaking: function() {
        return this.isSpeaking;
    },
    
    // Add a user to nearby users list
    addNearbyUser: function(pubkey, distance) {
        if (pubkey === Player.pubkey) return;
        
        // Add or update user
        this.nearbyUsers.set(pubkey, {
            distance,
            lastUpdate: Date.now(),
            speaking: false
        });
        
        // If voice chat is active, create a WebRTC connection
        if (this.isVoiceChatActive && !this.peers.has(pubkey)) {
            this.createPeerConnection(pubkey);
        }
    },
    
    // Remove a user from nearby users list
    removeNearbyUser: function(pubkey) {
        if (!this.nearbyUsers.has(pubkey)) return;
        
        // Remove user
        this.nearbyUsers.delete(pubkey);
        
        // Destroy WebRTC connection if exists
        if (this.peers.has(pubkey)) {
            this.peers.get(pubkey).destroy();
            this.peers.delete(pubkey);
        }
        
        // Remove voice indicator if exists
        const indicator = document.getElementById(`voice-indicator-${pubkey}`);
        if (indicator) {
            indicator.remove();
        }
    },
    
    // Create a WebRTC peer connection with another user
    createPeerConnection: function(pubkey) {
        if (!this.isVoiceChatActive || !this.localStream) return;
        
        console.log(`[Audio] Creating peer connection with ${pubkey.slice(0, 8)}`);
        
        try {
            // Create a new SimplePeer (WebRTC) connection
            // In a real implementation, you'd need to handle signaling via Nostr events
            // This is a simplified version assuming direct signaling
            
            const peer = new SimplePeer({
                initiator: true,
                stream: this.localStream,
                trickle: false
            });
            
            // Handle signals
            peer.on('signal', data => {
                // In a real implementation, send this signal data to the other peer
                // This would be done by publishing a Nostr event with the signal data
                console.log(`[Audio] Generated signal for ${pubkey.slice(0, 8)}`);
            });
            
            // Handle connected event
            peer.on('connect', () => {
                console.log(`[Audio] Connected to ${pubkey.slice(0, 8)}`);
            });
            
            // Handle stream event
            peer.on('stream', stream => {
                console.log(`[Audio] Received stream from ${pubkey.slice(0, 8)}`);
                this.handleRemoteStream(pubkey, stream);
            });
            
            // Handle close event
            peer.on('close', () => {
                console.log(`[Audio] Connection closed with ${pubkey.slice(0, 8)}`);
                this.peers.delete(pubkey);
            });
            
            // Handle error event
            peer.on('error', err => {
                console.error(`[Audio] Peer error with ${pubkey.slice(0, 8)}:`, err);
                this.peers.delete(pubkey);
            });
            
            // Store the peer connection
            this.peers.set(pubkey, peer);
            
            // Create a voice indicator for this user
            this.createVoiceIndicator(pubkey);
            
        } catch (error) {
            console.error(`[Audio] Failed to create peer connection with ${pubkey.slice(0, 8)}:`, error);
        }
    },
    
    // Handle an incoming signal from another user
    handleIncomingSignal: function(pubkey, signal) {
        if (!this.isVoiceChatActive || !this.localStream) return;
        
        try {
            let peer = this.peers.get(pubkey);
            
            // If peer doesn't exist, create it
            if (!peer) {
                peer = new SimplePeer({
                    initiator: false,
                    stream: this.localStream,
                    trickle: false
                });
                
                // Handle signals
                peer.on('signal', data => {
                    // In a real implementation, send this signal data to the other peer
                    console.log(`[Audio] Generated signal for ${pubkey.slice(0, 8)}`);
                });
                
                // Handle connected event
                peer.on('connect', () => {
                    console.log(`[Audio] Connected to ${pubkey.slice(0, 8)}`);
                });
                
                // Handle stream event
                peer.on('stream', stream => {
                    console.log(`[Audio] Received stream from ${pubkey.slice(0, 8)}`);
                    this.handleRemoteStream(pubkey, stream);
                });
                
                // Handle close event
                peer.on('close', () => {
                    console.log(`[Audio] Connection closed with ${pubkey.slice(0, 8)}`);
                    this.peers.delete(pubkey);
                });
                
                // Handle error event
                peer.on('error', err => {
                    console.error(`[Audio] Peer error with ${pubkey.slice(0, 8)}:`, err);
                    this.peers.delete(pubkey);
                });
                
                // Store the peer connection
                this.peers.set(pubkey, peer);
                
                // Create a voice indicator for this user
                this.createVoiceIndicator(pubkey);
            }
            
            // Process the signal
            peer.signal(signal);
            
        } catch (error) {
            console.error(`[Audio] Failed to handle incoming signal from ${pubkey.slice(0, 8)}:`, error);
        }
    },
    
    // Handle a remote stream from another user
    handleRemoteStream: function(pubkey, stream) {
        try {
            // Create audio element for this stream
            const audio = document.createElement('audio');
            audio.srcObject = stream;
            audio.id = `audio-${pubkey}`;
            audio.autoplay = true;
            
            // Set volume based on distance
            const user = this.nearbyUsers.get(pubkey);
            if (user) {
                this.updateAudioVolume(audio, user.distance);
            }
            
            // Add to document (hidden)
            audio.style.display = 'none';
            document.body.appendChild(audio);
            
            // Set up audio analysis for this stream (to detect if user is speaking)
            this.setupRemoteVoiceDetection(pubkey, stream);
            
        } catch (error) {
            console.error(`[Audio] Failed to handle remote stream from ${pubkey.slice(0, 8)}:`, error);
        }
    },
    
    // Set up voice detection for a remote stream
    setupRemoteVoiceDetection: function(pubkey, stream) {
        if (!this.audioContext) return;
        
        try {
            // Create audio source from stream
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyser node
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            // Connect source to analyser
            source.connect(analyser);
            
            // Create buffer for analysis
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Store analyser in user data
            const user = this.nearbyUsers.get(pubkey);
            if (user) {
                user.analyser = analyser;
                user.dataArray = dataArray;
            }
            
        } catch (error) {
            console.error(`[Audio] Failed to set up remote voice detection for ${pubkey.slice(0, 8)}:`, error);
        }
    },
    
    // Update audio volume based on distance
    updateAudioVolume: function(audioElement, distance) {
        if (!audioElement) return;
        
        // Calculate volume based on distance (0-1)
        const maxDistance = RelayWorld.config.VOICE_CHAT_RANGE;
        const volume = Math.max(0, 1 - (distance / maxDistance));
        
        // Apply volume
        audioElement.volume = volume;
    },
    
    // Create a voice indicator for a user
    createVoiceIndicator: function(pubkey) {
        const user = Nostr.getUser(pubkey);
        if (!user) return;
        
        // Create indicator element
        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        indicator.id = `voice-indicator-${pubkey}`;
        
        // Add to document
        document.getElementById('voice-chat-indicators').appendChild(indicator);
        
        // Position indicator near user
        this.updateVoiceIndicatorPosition(pubkey);
    },
    
    // Update voice indicator position
    updateVoiceIndicatorPosition: function(pubkey) {
        const indicator = document.getElementById(`voice-indicator-${pubkey}`);
        if (!indicator) return;
        
        const user = Nostr.getUser(pubkey);
        if (!user) return;
        
        // Calculate screen position
        const screenX = user.x - (Game.camera.x - Game.canvas.width / 2);
        const screenY = user.y - (Game.camera.y - Game.canvas.height / 2) - 60;
        
        // Update position
        indicator.style.left = `${screenX - 16}px`;
        indicator.style.top = `${screenY - 16}px`;
        
        // Check if user is speaking
        const nearbyUser = this.nearbyUsers.get(pubkey);
        if (nearbyUser && nearbyUser.speaking) {
            indicator.classList.add('speaking');
        } else {
            indicator.classList.remove('speaking');
        }
    },
    
    // Update all voice indicators
    updateVoiceIndicators: function() {
        if (!this.isVoiceChatActive) return;
        
        // Update all nearby users
        for (const [pubkey, user] of this.nearbyUsers) {
            // Update position
            this.updateVoiceIndicatorPosition(pubkey);
            
            // Update volume based on distance
            const audioElement = document.getElementById(`audio-${pubkey}`);
            if (audioElement) {
                this.updateAudioVolume(audioElement, user.distance);
            }
            
            // Check if user is speaking
            if (user.analyser && user.dataArray) {
                user.analyser.getByteFrequencyData(user.dataArray);
                
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < user.dataArray.length; i++) {
                    sum += user.dataArray[i];
                }
                const average = sum / user.dataArray.length;
                
                // Update speaking state
                user.speaking = average > this.speakingThreshold;
            }
        }
    },
    
    // Check if a user is speaking
    isUserSpeaking: function(pubkey) {
        const user = this.nearbyUsers.get(pubkey);
        return user ? user.speaking : false;
    },
    
    // Connect to all nearby users
    connectToNearbyUsers: function() {
        if (!this.isVoiceChatActive) return;
        
        for (const [pubkey, user] of this.nearbyUsers) {
            if (!this.peers.has(pubkey)) {
                this.createPeerConnection(pubkey);
            }
        }
    },
    
    // Clean up voice chat resources
    cleanupVoiceChat: function() {
        this.stopVoiceChat();
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close().catch(err => {
                console.error("[Audio] Failed to close audio context:", err);
            });
            this.audioContext = null;
        }
    }
};
