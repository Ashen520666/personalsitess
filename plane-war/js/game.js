(() => {
    'use strict';

    // ==================== 音频系统 ====================
    class AudioManager {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.musicGain = null;
            this.sfxGain = null;
            this.musicNodes = [];
            this.musicEnabled = true;
            this.soundEnabled = true;
            this.initialized = false;
            this.musicLoopTimer = null;
            this.arpTimer = null;
            this.nextNoteTime = 0;
            this.musicPlaying = false;
            this.musicLayer = 0;
        }

        init() {
            if (this.initialized) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.5;
                this.masterGain.connect(this.ctx.destination);

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = this.musicEnabled ? 0.3 : 0;
                this.musicGain.connect(this.masterGain);

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = this.soundEnabled ? 0.6 : 0;
                this.sfxGain.connect(this.masterGain);

                this.initialized = true;
            } catch (e) {
                console.warn('Web Audio API not supported');
            }
        }

        ensureContext() {
            if (!this.initialized) this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        setMusicEnabled(enabled) {
            this.musicEnabled = enabled;
            if (this.musicGain) {
                this.musicGain.gain.setTargetAtTime(enabled ? 0.3 : 0, this.ctx.currentTime, 0.3);
            }
            if (enabled) this.playMusic();
            else this.stopMusic();
        }

        setSoundEnabled(enabled) {
            this.soundEnabled = enabled;
            if (this.sfxGain) {
                this.sfxGain.gain.setTargetAtTime(enabled ? 0.6 : 0, this.ctx.currentTime, 0.1);
            }
        }

        isMusicPlaying() {
            return this.musicPlaying;
        }

        // 背景音乐：持续循环的太空氛围
        playMusic() {
            if (!this.initialized || !this.musicEnabled) return;
            this.ensureContext();
            this.stopMusic();
            this.musicPlaying = true;
            this.musicLayer = 0;
            const now = this.ctx.currentTime;

            // 持续的低频drone（A1音，55Hz）
            this.createDrone(now);
            
            // 持续的和声pad层（A小调和弦：A2, C3, E3）
            this.createPad(now);

            // 启动琶音序列
            this.nextNoteTime = now;
            this.scheduleArpeggio();

            // 每8秒循环创建新的音乐层，保持音乐持续
            this.scheduleMusicLoop();
        }

        createDrone(startTime) {
            if (!this.musicPlaying) return;
            const ctx = this.ctx;
            // 主drone - A1 (55Hz) with slight detune
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.value = 55;
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = 55.5; // slight detune for chorus effect
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.1, startTime + 2);
            gain.gain.linearRampToValueAtTime(0.08, startTime + 6);
            gain.gain.linearRampToValueAtTime(0, startTime + 8);

            // LFO for subtle volume modulation
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.15;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.02;
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            lfo.start(startTime);
            lfo.stop(startTime + 8);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.musicGain);
            osc1.start(startTime);
            osc2.start(startTime);
            osc1.stop(startTime + 8);
            osc2.stop(startTime + 8);

            this.musicNodes.push(osc1, osc2, gain, lfo, lfoGain);
        }

        createPad(startTime) {
            if (!this.musicPlaying) return;
            const ctx = this.ctx;
            // A minor chord: A2(110), C3(130.81), E3(164.81)
            const freqs = [110, 130.81, 164.81];
            const chordShift = this.musicLayer % 4;
            
            // 和弦进行：Am - F - C - G (i - VI - III - VII)
            const chords = [
                [110, 130.81, 164.81],  // Am
                [87.31, 130.81, 174.61], // F
                [130.81, 164.81, 196],   // C
                [98, 123.47, 146.83]     // G
            ];
            
            const chord = chords[chordShift];
            
            chord.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                
                const osc2 = ctx.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.value = freq * 2; // 一个八度上的泛音
                
                const gain = ctx.createGain();
                const vol = 0.04 - i * 0.008;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(vol, startTime + 3);
                gain.gain.linearRampToValueAtTime(vol * 0.8, startTime + 6);
                gain.gain.linearRampToValueAtTime(0, startTime + 8);

                osc.connect(gain);
                osc2.connect(gain);
                gain.connect(this.musicGain);
                osc.start(startTime);
                osc2.start(startTime);
                osc.stop(startTime + 8);
                osc2.stop(startTime + 8);
                
                this.musicNodes.push(osc, osc2, gain);
            });
        }

        scheduleArpeggio() {
            if (!this.initialized || !this.musicEnabled || !this.musicPlaying) return;
            const now = this.ctx.currentTime;
            // A minor pentatonic scale patterns
            const scales = [
                [220, 261.63, 329.63, 392, 440, 523.25],      // A minor pentatonic
                [174.61, 220, 261.63, 349.23, 440],           // F major pentatonic
                [261.63, 329.63, 392, 493.88, 523.25],        // C major pentatonic
                [196, 246.94, 293.66, 392, 493.88]            // G major pentatonic
            ];
            const scale = scales[this.musicLayer % 4];
            
            while (this.nextNoteTime < now + 3) {
                const freq = scale[Math.floor(Math.random() * scale.length)];
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                // 偶尔加一个高八度的音增加闪烁感
                if (Math.random() < 0.2) {
                    const osc2 = this.ctx.createOscillator();
                    osc2.type = 'sine';
                    osc2.frequency.value = freq * 2;
                    const gain2 = this.ctx.createGain();
                    gain2.gain.setValueAtTime(0, this.nextNoteTime);
                    gain2.gain.linearRampToValueAtTime(0.015, this.nextNoteTime + 0.03);
                    gain2.gain.exponentialRampToValueAtTime(0.001, this.nextNoteTime + 0.8);
                    osc2.connect(gain2);
                    gain2.connect(this.musicGain);
                    osc2.start(this.nextNoteTime);
                    osc2.stop(this.nextNoteTime + 0.8);
                    this.musicNodes.push(osc2, gain2);
                }
                
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0, this.nextNoteTime);
                gain.gain.linearRampToValueAtTime(0.035, this.nextNoteTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, this.nextNoteTime + 1.2);
                osc.connect(gain);
                gain.connect(this.musicGain);
                osc.start(this.nextNoteTime);
                osc.stop(this.nextNoteTime + 1.2);
                this.musicNodes.push(osc, gain);
                
                this.nextNoteTime += 0.35 + Math.random() * 0.4;
            }
            
            if (this.musicPlaying && this.musicEnabled) {
                this.arpTimer = setTimeout(() => this.scheduleArpeggio(), 1000);
            }
        }

        scheduleMusicLoop() {
            if (!this.musicPlaying || !this.musicEnabled) return;
            
            this.musicLoopTimer = setTimeout(() => {
                if (!this.musicPlaying) return;
                this.musicLayer++;
                const now = this.ctx.currentTime;
                this.createDrone(now);
                this.createPad(now);
                // 清理已结束的节点
                this.cleanupNodes();
                this.scheduleMusicLoop();
            }, 8000);
        }

        cleanupNodes() {
            const ctx = this.ctx;
            this.musicNodes = this.musicNodes.filter(node => {
                try {
                    // 简单地保留节点，不尝试断开，避免错误
                    return true;
                } catch (e) {
                    return false;
                }
            });
        }

        stopMusic() {
            this.musicPlaying = false;
            if (this.musicLoopTimer) {
                clearTimeout(this.musicLoopTimer);
                this.musicLoopTimer = null;
            }
            if (this.arpTimer) {
                clearTimeout(this.arpTimer);
                this.arpTimer = null;
            }
            // 渐出后停止
            if (this.musicGain && this.initialized) {
                this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
                setTimeout(() => {
                    this.musicNodes.forEach(node => {
                        try {
                            if (node.stop) node.stop();
                            if (node.disconnect) node.disconnect();
                        } catch (e) {}
                    });
                    this.musicNodes = [];
                    if (this.musicGain && this.musicEnabled) {
                        this.musicGain.gain.value = 0.3;
                    }
                }, 600);
            } else {
                this.musicNodes.forEach(node => {
                    try {
                        if (node.stop) node.stop();
                        if (node.disconnect) node.disconnect();
                    } catch (e) {}
                });
                this.musicNodes = [];
            }
        }

        // 音效
        playShoot() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.12);
        }

        playExplosion() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, t);
            filter.frequency.exponentialRampToValueAtTime(100, t + 0.4);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);
            noise.start(t);
        }

        playHit() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.1);
        }

        playPowerUp() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.linearRampToValueAtTime(880, t + 0.15);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.2);
        }

        playUltimate() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.6);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.8);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.8);
        }

        playBossAppear() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 1.2);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 1.2);
        }

        playClick() {
            this.ensureContext();
            if (!this.initialized || !this.soundEnabled) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.05);
        }
    }

    const audioManager = new AudioManager();
    // ==================== 音频系统结束 ====================

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    let gameWidth = 0;
    let gameHeight = 0;
    let gameState = 'menu';
    let currentMode = 'endless';
    let currentShip = 'falcon';
    let lastTime = 0;
    let deltaTime = 0;
    let shakeAmount = 0;
    let slowMotion = 1;

    const stars = [];
    let playerBullets = [];
    let enemyBullets = [];
    let enemies = [];
    let particles = [];
    let powerUps = [];
    let meteors = [];

    let score = 0;
    let coins = 0;
    let totalCoins = 0;
    let killCount = 0;
    let combo = 0;
    let comboTimer = 0;
    let waveNumber = 0;
    let spawnTimer = 0;
    let spawnInterval = 2;
    let difficulty = 1;
    let gameStartTime = 0;
    let challengeTimer = 0;
    let bossRushIndex = 0;
    
    let currentLevel = 1;
    let totalLevels = 10;
    let levelKills = 0;
    let levelKillsRequired = 15;
    let bossSpawned = false;
    let levelComplete = false;
    let gameWon = false;
    let levelTransitionTimer = 0;

    const STORAGE_KEY = 'starfighter_data';

    let gameData = {
        coins: 0,
        highScore: {
            classic: 0,
            endless: 0,
            challenge: 0,
            bossrush: 0
        },
        unlockedShips: ['falcon'],
        shop: {
            healthUp: 0,
            weaponStart: 1,
            coinMultiplier: 0,
            startShield: 0,
            damageUp: 0,
            speedUp: 0,
            energyStart: 0,
            revive: 0
        },
        settings: {
            soundEnabled: true,
            musicEnabled: true,
            quality: 'medium'
        }
    };

    const shopItems = {
        healthUp: { baseCost: 100, maxLevel: 10, costGrowth: 50, label: '生命强化' },
        weaponStart: { baseCost: 500, maxLevel: 3, costGrowth: 300, label: '初始武器' },
        coinMultiplier: { baseCost: 300, maxLevel: 10, costGrowth: 150, label: '金币磁铁' },
        startShield: { baseCost: 200, maxLevel: 1, costGrowth: 0, label: '开局护盾' },
        damageUp: { baseCost: 400, maxLevel: 10, costGrowth: 200, label: '火力强化' },
        speedUp: { baseCost: 350, maxLevel: 10, costGrowth: 150, label: '机动强化' },
        energyStart: { baseCost: 250, maxLevel: 5, costGrowth: 150, label: '初始能量' },
        revive: { baseCost: 800, maxLevel: 99, costGrowth: 200, label: '复活十字架' }
    };

    const player = {
        x: 0,
        y: 0,
        width: 48,
        height: 56,
        targetX: 0,
        targetY: 0,
        speed: 400,
        health: 100,
        maxHealth: 100,
        weaponType: 'single',
        weaponLevel: 1,
        fireRate: 0.15,
        fireTimer: 0,
        energy: 0,
        maxEnergy: 100,
        shield: false,
        invincible: false,
        invincibleTimer: 0,
        wingmen: [],
        coinMultiplier: 1,
        slowTimeActive: false,
        slowTimeTimer: 0,
        reviveCount: 0,
        damageMultiplier: 1,
        stealthActive: false,
        stealthTimer: 0,
        stealthSpeedBonus: 0
    };

    const shipConfigs = {
        falcon: { health: 100, speed: 400, fireRate: 0.15, damage: 1, color: '#00d4ff', name: '猎鹰号' },
        thunder: { health: 120, speed: 480, fireRate: 0.12, damage: 1.2, color: '#ffdd00', name: '雷霆号' },
        phantom: { health: 80, speed: 560, fireRate: 0.18, damage: 1, color: '#ff00ff', name: '幻影号' },
        fortress: { health: 200, speed: 320, fireRate: 0.2, damage: 1.5, color: '#00ff88', name: '堡垒号' },
        meteor: { health: 150, speed: 400, fireRate: 0.1, damage: 2, color: '#ff8800', name: '星陨号' }
    };

    function init() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        loadGameData();
        ensureShopData();
        audioManager.musicEnabled = gameData.settings.musicEnabled;
        audioManager.soundEnabled = gameData.settings.soundEnabled;
        setupInputHandlers();
        setupUIHandlers();
        createStars();
        requestAnimationFrame(gameLoop);

        // 首次用户交互时启动音频（浏览器自动播放策略要求）
        const startMusicOnInteract = () => {
            audioManager.ensureContext();
            if (audioManager.musicEnabled && !audioManager.isMusicPlaying()) {
                audioManager.playMusic();
            }
            document.removeEventListener('click', startMusicOnInteract);
            document.removeEventListener('touchstart', startMusicOnInteract);
            document.removeEventListener('keydown', startMusicOnInteract);
        };
        document.addEventListener('click', startMusicOnInteract);
        document.addEventListener('touchstart', startMusicOnInteract);
        document.addEventListener('keydown', startMusicOnInteract);
    }

    function resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const aspectRatio = 9 / 16;
        
        let width = window.innerWidth;
        let height = window.innerHeight;
        
        if (width / height > aspectRatio) {
            width = height * aspectRatio;
        } else {
            height = width / aspectRatio;
        }
        
        canvas.width = width;
        canvas.height = height;
        gameWidth = width;
        gameHeight = height;
        
        player.targetX = gameWidth / 2;
        player.targetY = gameHeight * 0.8;
        if (gameState === 'menu') {
            player.x = player.targetX;
            player.y = player.targetY;
        }
    }

    function createStars() {
        stars.length = 0;
        const count = 80;
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * gameWidth,
                y: Math.random() * gameHeight,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 60 + 20,
                alpha: Math.random() * 0.6 + 0.2
            });
        }
    }

    function setupInputHandlers() {
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('keydown', handleKeyDown);
    }

    function handleMouseMove(e) {
        if (gameState !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        player.targetX = (e.clientX - rect.left) * (canvas.width / rect.width);
        player.targetY = (e.clientY - rect.top) * (canvas.height / rect.height);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (gameState !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        player.targetX = (touch.clientX - rect.left) * (canvas.width / rect.width);
        player.targetY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    }

    let lastTapTime = 0;
    function handleTouchStart(e) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            if (gameState === 'playing') {
                useUltimate();
            }
        }
        lastTapTime = now;
    }

    function handleKeyDown(e) {
        if (e.code === 'Space' && gameState === 'playing') {
            e.preventDefault();
            useUltimate();
        }
        if (e.code === 'KeyP') {
            if (gameState === 'playing') {
                pauseGame();
            } else if (gameState === 'paused') {
                resumeGame();
            }
        }
        if (e.code === 'Escape') {
            if (gameState === 'playing') {
                pauseGame();
            }
        }
    }

    function setupUIHandlers() {
        const addClickSound = (fn) => (e) => {
            audioManager.playClick();
            return fn.call(this, e);
        };

        document.getElementById('btnStart').addEventListener('click', addClickSound(showModeSelect));
        document.getElementById('btnShop').addEventListener('click', addClickSound(showShop));
        document.getElementById('btnLeaderboard').addEventListener('click', addClickSound(showLeaderboard));
        document.getElementById('btnSettings').addEventListener('click', addClickSound(showSettings));
        document.getElementById('btnBackToMenu').addEventListener('click', addClickSound(showMainMenu));
        document.getElementById('btnShopBack').addEventListener('click', addClickSound(showMainMenu));
        document.getElementById('btnBackToMode').addEventListener('click', addClickSound(showModeSelect));
        document.getElementById('btnConfirmShip').addEventListener('click', addClickSound(startGame));
        document.getElementById('btnPause').addEventListener('click', addClickSound(pauseGame));
        document.getElementById('btnResume').addEventListener('click', addClickSound(resumeGame));
        document.getElementById('btnRestart').addEventListener('click', addClickSound(restartGame));
        document.getElementById('btnQuit').addEventListener('click', addClickSound(quitToMenu));
        document.getElementById('btnPlayAgain').addEventListener('click', addClickSound(restartGame));
        document.getElementById('btnGameOverMenu').addEventListener('click', addClickSound(quitToMenu));
        document.getElementById('btnVictoryPlayAgain').addEventListener('click', addClickSound(restartGame));
        document.getElementById('btnVictoryMenu').addEventListener('click', addClickSound(quitToMenu));
        document.getElementById('btnLeaderboardBack').addEventListener('click', addClickSound(showMainMenu));
        document.getElementById('btnSettingsBack').addEventListener('click', addClickSound(showMainMenu));

        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                audioManager.playClick();
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                currentMode = card.dataset.mode;
                showShipSelect();
            });
        });

        // 使用事件委托处理战机卡片点击，确保解锁后的卡片也能响应
        const shipCardsContainer = document.querySelector('.ship-cards');
        if (shipCardsContainer) {
            shipCardsContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.ship-card');
                if (!card || card.classList.contains('locked')) return;
                audioManager.playClick();
                document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                currentShip = card.dataset.ship;
            });
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                audioManager.playClick();
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateLeaderboard(btn.dataset.tab);
            });
        });

        const soundToggle = document.getElementById('soundToggle');
        soundToggle.addEventListener('click', () => {
            soundToggle.classList.toggle('active');
            gameData.settings.soundEnabled = soundToggle.classList.contains('active');
            audioManager.setSoundEnabled(gameData.settings.soundEnabled);
            saveGameData();
        });
        if (gameData.settings.soundEnabled) {
            soundToggle.classList.add('active');
        }

        const musicToggle = document.getElementById('musicToggle');
        musicToggle.addEventListener('click', () => {
            musicToggle.classList.toggle('active');
            gameData.settings.musicEnabled = musicToggle.classList.contains('active');
            audioManager.setMusicEnabled(gameData.settings.musicEnabled);
            saveGameData();
        });
        if (gameData.settings.musicEnabled) {
            musicToggle.classList.add('active');
        }

        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gameData.settings.quality = btn.dataset.quality;
                saveGameData();
            });
        });
        const qualityBtns = document.querySelectorAll('.quality-btn');
        qualityBtns.forEach(btn => {
            if (btn.dataset.quality === gameData.settings.quality) {
                btn.classList.add('active');
            }
        });

        // 商店购买按钮使用事件委托
        const shopItemsContainer = document.querySelector('.shop-items');
        if (shopItemsContainer) {
            shopItemsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-buy');
                if (!btn) return;
                audioManager.playClick();
                buyShopItem(btn.dataset.item);
            });
        }
    }

    function showMainMenu() {
        gameState = 'menu';
        hideAllScreens();
        document.getElementById('mainMenu').classList.remove('hidden');
        document.getElementById('gameHUD').classList.add('hidden');
        // 返回菜单时播放背景音乐
        if (audioManager.musicEnabled && !audioManager.isMusicPlaying()) {
            audioManager.ensureContext();
            audioManager.playMusic();
        }
    }

    function showModeSelect() {
        gameState = 'modeSelect';
        hideAllScreens();
        document.getElementById('modeSelect').classList.remove('hidden');
    }

    function showLeaderboard() {
        gameState = 'leaderboard';
        hideAllScreens();
        document.getElementById('leaderboardScreen').classList.remove('hidden');
        updateLeaderboard('endless');
    }

    function showSettings() {
        gameState = 'settings';
        hideAllScreens();
        document.getElementById('settingsScreen').classList.remove('hidden');
    }

    function showShop() {
        gameState = 'shop';
        hideAllScreens();
        document.getElementById('shopScreen').classList.remove('hidden');
        updateShopUI();
    }

    function getShopItemCost(itemKey) {
        const item = shopItems[itemKey];
        const current = gameData.shop[itemKey] || 0;
        return item.baseCost + current * item.costGrowth;
    }

    function buyShopItem(itemKey) {
        const item = shopItems[itemKey];
        if (!item) return;

        const current = gameData.shop[itemKey] || 0;
        if (current >= item.maxLevel) return;

        const cost = getShopItemCost(itemKey);
        if (gameData.coins < cost) {
            createFloatText(gameWidth / 2, gameHeight / 2, '金币不足!', '#ff2244');
            return;
        }

        gameData.coins -= cost;
        gameData.shop[itemKey] = current + 1;
        saveGameData();
        updateShopUI();

        createFloatText(gameWidth / 2, gameHeight / 2, `购买 ${item.label} 成功!`, '#ffd700');
    }

    function updateShopUI() {
        document.getElementById('shopCoinCount').textContent = gameData.coins.toLocaleString();

        const shop = gameData.shop;
        document.getElementById('healthBonusLevel').textContent = (shop.healthUp || 0) * 10;
        document.getElementById('weaponStartLevel').textContent = (shop.weaponStart || 1);
        document.getElementById('coinMultiplierLevel').textContent = (shop.coinMultiplier || 0) * 10;
        document.getElementById('startShieldStatus').textContent = (shop.startShield || 0) > 0 ? '已激活' : '未激活';
        document.getElementById('damageBonusLevel').textContent = (shop.damageUp || 0) * 5;
        document.getElementById('speedBonusLevel').textContent = (shop.speedUp || 0) * 5;
        document.getElementById('energyStartLevel').textContent = (shop.energyStart || 0) * 20;
        document.getElementById('reviveCount').textContent = shop.revive || 0;

        document.querySelectorAll('.shop-item').forEach(el => {
            const itemKey = el.dataset.item;
            const item = shopItems[itemKey];
            const current = gameData.shop[itemKey] || 0;
            const btn = el.querySelector('.btn-buy');

            if (current >= item.maxLevel) {
                btn.textContent = '已满级';
                btn.disabled = true;
                btn.classList.add('maxed');
            } else {
                const cost = getShopItemCost(itemKey);
                btn.textContent = `${cost} 金币`;
                btn.disabled = gameData.coins < cost;
                btn.classList.remove('maxed');
            }
        });
    }

    function ensureShopData() {
        if (!gameData.shop) {
            gameData.shop = {
                healthUp: 0,
                weaponStart: 1,
                coinMultiplier: 0,
                startShield: 0,
                damageUp: 0,
                speedUp: 0,
                energyStart: 0,
                revive: 0
            };
        } else {
            const defaults = {
                healthUp: 0,
                weaponStart: 1,
                coinMultiplier: 0,
                startShield: 0,
                damageUp: 0,
                speedUp: 0,
                energyStart: 0,
                revive: 0
            };
            for (let key in defaults) {
                if (typeof gameData.shop[key] !== 'number') {
                    gameData.shop[key] = defaults[key];
                }
            }
        }
    }

    function hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    }

    function startGame() {
        resetGame();
        gameState = 'playing';
        hideAllScreens();
        document.getElementById('gameHUD').classList.remove('hidden');
        // 确保音乐在播放
        if (audioManager.musicEnabled && !audioManager.isMusicPlaying()) {
            audioManager.ensureContext();
            audioManager.playMusic();
        }
    }

    function pauseGame() {
        if (gameState !== 'playing') return;
        gameState = 'paused';
        document.getElementById('pauseMenu').classList.remove('hidden');
        // 暂停时不停止音乐，保持氛围
    }

    function resumeGame() {
        if (gameState !== 'paused') return;
        gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
        // 继续游戏，音乐本来就在播放
    }

    function restartGame() {
        resetGame();
        gameState = 'playing';
        hideAllScreens();
        document.getElementById('gameHUD').classList.remove('hidden');
        // 确保音乐在播放
        if (audioManager.musicEnabled && !audioManager.isMusicPlaying()) {
            audioManager.ensureContext();
            audioManager.playMusic();
        }
    }

    function quitToMenu() {
        gameState = 'menu';
        hideAllScreens();
        document.getElementById('mainMenu').classList.remove('hidden');
        document.getElementById('gameHUD').classList.add('hidden');
        // 返回菜单时继续播放音乐
        if (audioManager.musicEnabled && !audioManager.isMusicPlaying()) {
            audioManager.ensureContext();
            audioManager.playMusic();
        }
    }

    function gameOver() {
        gameState = 'gameover';
        audioManager.stopMusic();
        
        if (score > gameData.highScore[currentMode]) {
            gameData.highScore[currentMode] = score;
            document.getElementById('newRecord').classList.remove('hidden');
        } else {
            document.getElementById('newRecord').classList.add('hidden');
        }
        
        gameData.coins += coins;
        saveGameData();
        
        document.getElementById('finalScore').textContent = score.toLocaleString();
        document.getElementById('highScore').textContent = gameData.highScore[currentMode].toLocaleString();
        document.getElementById('killCount').textContent = killCount;
        document.getElementById('earnedCoins').textContent = '+' + coins;
        
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    function resetGame() {
        const config = shipConfigs[currentShip] || shipConfigs.falcon;
        const shop = gameData.shop;

        player.x = gameWidth / 2;
        player.y = gameHeight * 0.8;
        player.targetX = player.x;
        player.targetY = player.y;
        player.maxHealth = config.health + (shop.healthUp || 0) * 10;
        player.health = player.maxHealth;
        player.speed = config.speed + (shop.speedUp || 0) * 5;
        player.fireRate = config.fireRate;
        player.weaponType = 'single';
        player.weaponLevel = Math.min(3, shop.weaponStart || 1);
        player.fireTimer = 0;
        player.energy = player.maxEnergy * (shop.energyStart || 0) * 0.2;
        player.shield = (shop.startShield || 0) > 0;
        player.invincible = false;
        player.invincibleTimer = 0;
        player.wingmen = [];
        player.coinMultiplier = 1 + (shop.coinMultiplier || 0) * 0.1;
        player.damageMultiplier = 1 + (shop.damageUp || 0) * 0.05;
        player.slowTimeActive = false;
        player.slowTimeTimer = 0;
        player.reviveCount = shop.revive || 0;
        player.stealthActive = false;
        player.stealthTimer = 0;
        player.stealthSpeedBonus = 0;

        // 消耗一次性道具
        let consumedItems = false;
        if (shop.startShield > 0) {
            shop.startShield = 0;
            consumedItems = true;
        }
        if (shop.revive > 0) {
            shop.revive = 0;
            consumedItems = true;
        }
        if (consumedItems) {
            saveGameData();
        }
        
        playerBullets = [];
        enemyBullets = [];
        enemies = [];
        particles = [];
        powerUps = [];
        
        score = 0;
        coins = 0;
        killCount = 0;
        combo = 0;
        comboTimer = 0;
        waveNumber = 0;
        spawnTimer = 0;
        spawnInterval = 2;
        difficulty = 1;
        shakeAmount = 0;
        slowMotion = 1;
        gameStartTime = Date.now();
        
        currentLevel = 1;
        levelKills = 0;
        levelKillsRequired = 15;
        bossSpawned = false;
        levelComplete = false;
        gameWon = false;
        levelTransitionTimer = 0;
        
        if (currentMode === 'classic') {
            difficulty = 1;
            spawnInterval = 2;
        } else if (currentMode === 'endless') {
            difficulty = 1;
            spawnInterval = 1.4;
        } else if (currentMode === 'challenge') {
            difficulty = 1.5;
            spawnInterval = 1.0;
            challengeTimer = 60;
        } else if (currentMode === 'bossrush') {
            difficulty = 2;
            spawnInterval = 2.5;
            bossRushIndex = 0;
            spawnBossRush();
        }
        
        updateHUD();
    }

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        
        const dt = Math.min(deltaTime, 0.05) * slowMotion;
        
        update(dt);
        render();
        
        requestAnimationFrame(gameLoop);
    }

    function update(dt) {
        updateStars(dt);
        updateParticles(dt);
        
        if (gameState !== 'playing') return;
        
        updatePlayer(dt);
        updateBullets(dt);
        updateEnemies(dt);
        updatePowerUps(dt);
        updateSpawner(dt);
        updateMeteors(dt);
        checkCollisions();
        updateCombo(dt);
        
        if (shakeAmount > 0) {
            shakeAmount *= 0.92;
            if (shakeAmount < 0.1) shakeAmount = 0;
        }
        
        if (player.slowTimeActive) {
            player.slowTimeTimer -= dt;
            if (player.slowTimeTimer <= 0) {
                player.slowTimeActive = false;
                slowMotion = 1;
            }
        }
        
        if (player.invincible) {
            player.invincibleTimer -= dt;
            if (player.invincibleTimer <= 0) {
                player.invincible = false;
            }
        }

        if (player.stealthActive) {
            player.stealthTimer -= dt;
            if (player.stealthTimer <= 0) {
                player.stealthActive = false;
                player.stealthSpeedBonus = 0;
            }
        }

        if (currentMode === 'classic' && levelComplete && !gameWon) {
            levelTransitionTimer += dt;
            if (levelTransitionTimer >= 1.0) {
                levelTransitionTimer = 0;
                levelComplete = false;
                advanceLevel();
            }
        }

        if (currentMode === 'challenge') {
            challengeTimer -= dt;
            if (challengeTimer <= 0) {
                challengeTimer = 0;
                gameOver();
            }
        }
        
        updateHUD();
    }

    function updateStars(dt) {
        for (let star of stars) {
            star.y += star.speed * dt;
            if (star.y > gameHeight) {
                star.y = -5;
                star.x = Math.random() * gameWidth;
            }
        }
    }

    function updatePlayer(dt) {
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const moveSpeed = (player.speed + player.stealthSpeedBonus) * dt;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > moveSpeed) {
            player.x += (dx / dist) * moveSpeed;
            player.y += (dy / dist) * moveSpeed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;
        }
        
        player.x = Math.max(player.width / 2, Math.min(gameWidth - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(gameHeight - player.height / 2, player.y));
        
        player.fireTimer += dt;
        if (player.fireTimer >= player.fireRate) {
            playerShoot();
            player.fireTimer = 0;
        }
        
        if (Math.random() < 0.5) {
            createEngineParticle();
        }
        
        for (let i = player.wingmen.length - 1; i >= 0; i--) {
            const wm = player.wingmen[i];
            wm.timer -= dt;
            if (wm.timer <= 0) {
                player.wingmen.splice(i, 1);
            } else {
                wm.fireTimer += dt;
                if (wm.fireTimer >= player.fireRate * 1.2) {
                    wingmanShoot(wm);
                    wm.fireTimer = 0;
                }
            }
        }
    }

    function playerShoot() {
        audioManager.playShoot();
        const config = shipConfigs[currentShip] || shipConfigs.falcon;
        const baseDamage = config.damage * (player.damageMultiplier || 1);
        
        if (player.weaponType === 'single') {
            const bulletCount = Math.min(player.weaponLevel, 3);
            const spread = 12;
            
            for (let i = 0; i < bulletCount; i++) {
                let offsetX = 0;
                if (bulletCount === 2) {
                    offsetX = (i === 0 ? -1 : 1) * spread / 2;
                } else if (bulletCount === 3) {
                    offsetX = (i - 1) * spread;
                }
                
                playerBullets.push({
                    x: player.x + offsetX,
                    y: player.y - player.height / 2,
                    width: 6,
                    height: 16,
                    vy: -600,
                    vx: 0,
                    damage: baseDamage * player.weaponLevel,
                    color: config.color,
                    type: 'normal'
                });
            }
        } else if (player.weaponType === 'spread') {
            // 削弱后期：子弹数量从 5-17 调整为 5-13，穿透成长降低
            const bulletCount = 5 + (player.weaponLevel - 1) * 2;
            const angleSpread = Math.PI / 3;
            const startAngle = -Math.PI / 2 - angleSpread / 2;
            const angleStep = angleSpread / (bulletCount - 1);
            
            for (let i = 0; i < bulletCount; i++) {
                const angle = startAngle + angleStep * i;
                const speed = 550;
                playerBullets.push({
                    x: player.x,
                    y: player.y - player.height / 2,
                    width: 6,
                    height: 14,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    damage: baseDamage * 0.8,
                    color: '#ff00ff',
                    type: 'normal',
                    pierce: 2 + Math.floor(player.weaponLevel / 2)
                });
            }
        }
    }

    function wingmanShoot(wm) {
        audioManager.playShoot();
        playerBullets.push({
            x: wm.x,
            y: wm.y - 10,
            width: 4,
            height: 10,
            vy: -500,
            vx: 0,
            damage: 0.5,
            color: '#00ff88',
            type: 'normal'
        });
    }

    function updateBullets(dt) {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const b = playerBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            if (b.y < -20 || b.y > gameHeight + 20 || b.x < -20 || b.x > gameWidth + 20) {
                playerBullets.splice(i, 1);
            }
        }
        
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            if (b.y < -20 || b.y > gameHeight + 20 || b.x < -20 || b.x > gameWidth + 20) {
                enemyBullets.splice(i, 1);
            }
        }
    }

    function updateEnemies(dt) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            
            e.update(dt);
            
            if (e.y > gameHeight + 50 || e.health <= 0) {
                if (e.health <= 0) {
                    onEnemyKilled(e);
                }
                enemies.splice(i, 1);
            }
        }
    }

    function updatePowerUps(dt) {
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.y += p.speed * dt;
            p.rotation += dt * 2;
            
            if (p.y > gameHeight + 30) {
                powerUps.splice(i, 1);
            }
        }
    }

    function updateMeteors(dt) {
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            const dx = m.targetX - m.x;
            const dy = m.targetY - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const move = m.speed * dt;

            if (dist <= move) {
                // 陨石落地，造成范围伤害
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j];
                    const ex = e.x - m.x;
                    const ey = e.y - m.y;
                    if (ex * ex + ey * ey <= m.radius * m.radius) {
                        e.health -= m.damage;
                        if (e.health <= 0) {
                            onEnemyKilled(e);
                            enemies.splice(j, 1);
                        }
                    }
                }
                createExplosion(m.x, m.y, m.color, 30);
                shakeScreen(10);
                meteors.splice(i, 1);
            } else {
                m.x += (dx / dist) * move;
                m.y += (dy / dist) * move;
            }
        }
    }

    function updateSpawner(dt) {
        if (currentMode === 'classic') {
            updateClassicLevel(dt);
            return;
        }

        if (currentMode === 'bossrush') {
            // Boss Rush 不在这里生成普通敌人，由 boss 死亡事件触发下一个
            return;
        }
        
        spawnTimer += dt;
        
        const maxEnemies = currentMode === 'challenge' ? 30 : (currentMode === 'bossrush' ? 12 : 25);
        if (spawnTimer >= spawnInterval && enemies.length < maxEnemies) {
            spawnEnemy();
            spawnTimer = 0;
            
            waveNumber++;
            if (waveNumber % 10 === 0) {
                difficulty += 0.2;
                spawnInterval = Math.max(0.35, spawnInterval * 0.9);
            }
        }
    }
    
    function updateClassicLevel(dt) {
        if (gameWon || levelComplete) return;
        
        if (levelKills >= levelKillsRequired && !bossSpawned) {
            const isBossLevel = (currentLevel === 5 || currentLevel === 10);
            if (isBossLevel) {
                bossSpawned = true;
                const bossType = currentLevel === 10 ? 'boss' : 'miniBoss';
                const boss = createEnemy(bossType, gameWidth / 2, -100);
                boss.startX = gameWidth / 2;
                enemies.push(boss);
                audioManager.playBossAppear();
            } else {
                levelComplete = true;
            }
            return;
        }
        
        const nonBossCount = enemies.filter(e => e.type !== 'boss' && e.type !== 'miniBoss').length;
        const maxClassicEnemies = bossSpawned ? 7 : 15;
        if (nonBossCount < maxClassicEnemies) {
            spawnTimer += dt;
            
            const levelSpawnInterval = Math.max(0.5, 1.6 - currentLevel * 0.08);
            if (spawnTimer >= levelSpawnInterval) {
                spawnEnemy();
                spawnTimer = 0;
            }
        }
    }
    
    function advanceLevel() {
        if (currentLevel >= totalLevels) {
            gameWon = true;
            gameState = 'gameover';
            unlockShip('fortress');
            showVictoryScreen();
            return;
        }
        
        if (currentLevel === 5) {
            unlockShip('thunder');
        }
        
        currentLevel++;
        levelKills = 0;
        levelKillsRequired = 15 + currentLevel * 3;
        bossSpawned = false;
        levelComplete = false;
        difficulty = 1 + (currentLevel - 1) * 0.3;
        spawnTimer = 0;
        waveNumber = 0;
        
        enemies = [];
        enemyBullets = [];
        
        showLevelTransition();
    }
    
    function showLevelTransition() {
        const overlay = document.getElementById('levelTransition');
        if (overlay) {
            document.getElementById('levelNum').textContent = currentLevel;
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 2000);
        }
    }
    
    function showVictoryScreen() {
        audioManager.stopMusic();
        document.getElementById('gameOverScreen').classList.add('hidden');
        const victoryScreen = document.getElementById('victoryScreen');
        if (victoryScreen) {
            victoryScreen.classList.remove('hidden');
            
            document.getElementById('victoryScore').textContent = score;
            document.getElementById('victoryKills').textContent = killCount;
            document.getElementById('victoryCoins').textContent = '+' + coins;
            
            if (score > gameData.highScore[currentMode]) {
                gameData.highScore[currentMode] = score;
            }
            gameData.coins += coins;
            saveGameData();
        }
    }

    function showBossRushVictory() {
        gameState = 'gameover';
        gameWon = true;
        showVictoryScreen();
    }

    function spawnEnemy() {
        const types = ['scout', 'fighter', 'bomber', 'interceptor', 'sniper', 'stealth', 'destroyer'];
        const weights = [35, 28, 12, 10, 7, 5, 3];
        
        // 随难度提升，高级敌人出现概率增加
        if (difficulty > 1.5) {
            weights[3] += 5; // interceptor
            weights[4] += 3; // sniper
        }
        if (difficulty > 2.5) {
            weights[5] += 4; // stealth
            weights[6] += 3; // destroyer
        }
        if (difficulty > 3.5) {
            weights[0] -= 8; // scout 减少
            weights[1] -= 5; // fighter 减少
            weights[5] += 5; // stealth 增加
            weights[6] += 5; // destroyer 增加
        }
        
        // 确保权重不会为负
        for (let i = 0; i < weights.length; i++) {
            weights[i] = Math.max(0, weights[i]);
        }
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalWeight;
        let type = types[0];
        
        for (let i = 0; i < types.length; i++) {
            rand -= weights[i];
            if (rand <= 0) {
                type = types[i];
                break;
            }
        }
        
        const x = Math.random() * (gameWidth - 60) + 30;
        const enemy = createEnemy(type, x, -30);
        enemies.push(enemy);
    }

    function spawnBossRush() {
        const bossTypes = ['miniBoss', 'boss', 'boss', 'boss', 'boss'];
        const type = bossRushIndex < bossTypes.length ? bossTypes[bossRushIndex] : 'boss';
        const x = gameWidth / 2;
        const boss = createEnemy(type, x, -120);
        boss.startX = x;

        // Boss Rush 特色：血量降低 50%、攻击速度 +50%，随进度小幅递增
        const progressScale = 1 + bossRushIndex * 0.15;
        boss.maxHealth = Math.ceil(boss.maxHealth * 0.5 * progressScale);
        boss.health = boss.maxHealth;
        boss.score = Math.floor(boss.score * progressScale);
        boss.fireRate = boss.fireRate / (1.5 * progressScale);

        audioManager.playBossAppear();
        enemies.push(boss);
    }

    function createEnemy(type, x, y) {
        const configs = {
            scout: {
                width: 24,
                height: 24,
                health: 1,
                speed: 180,
                score: 100,
                coin: 5,
                color: '#888899',
                fireRate: 0,
                behavior: 'straight'
            },
            fighter: {
                width: 32,
                height: 32,
                health: 3,
                speed: 120,
                score: 200,
                coin: 10,
                color: '#ff4466',
                fireRate: 1.5,
                behavior: 'zigzag'
            },
            bomber: {
                width: 48,
                height: 40,
                health: 10,
                speed: 70,
                score: 500,
                coin: 25,
                color: '#228844',
                fireRate: 2,
                behavior: 'spread'
            },
            elite: {
                width: 40,
                height: 44,
                health: 20,
                speed: 100,
                score: 800,
                coin: 50,
                color: '#aa44ff',
                fireRate: 1,
                behavior: 'homing'
            },
            miniBoss: {
                width: 80,
                height: 70,
                health: 200,
                speed: 40,
                score: 5000,
                coin: 200,
                color: '#ff44aa',
                fireRate: 0.8,
                behavior: 'boss'
            },
            boss: {
                width: 120,
                height: 100,
                health: 500,
                speed: 30,
                score: 20000,
                coin: 500,
                color: '#ff2244',
                fireRate: 0.5,
                behavior: 'boss'
            },
            interceptor: {
                width: 28,
                height: 28,
                health: 2,
                speed: 260,
                score: 150,
                coin: 8,
                color: '#ff6600',
                fireRate: 0,
                behavior: 'charge'
            },
            sniper: {
                width: 26,
                height: 26,
                health: 2,
                speed: 90,
                score: 250,
                coin: 12,
                color: '#00ccff',
                fireRate: 2,
                behavior: 'sniper'
            },
            destroyer: {
                width: 52,
                height: 44,
                health: 18,
                speed: 55,
                score: 700,
                coin: 35,
                color: '#ff8800',
                fireRate: 2.2,
                behavior: 'destroyer'
            },
            stealth: {
                width: 30,
                height: 30,
                health: 4,
                speed: 150,
                score: 350,
                coin: 15,
                color: '#aa00ff',
                fireRate: 2.5,
                behavior: 'stealth'
            }
        };
        
        const cfg = configs[type] || configs.scout;
        const healthMult = 1 + (difficulty - 1) * 0.3;
        const speedMult = 1 + (difficulty - 1) * 0.15;
        
        return {
            type,
            x,
            y,
            width: cfg.width,
            height: cfg.height,
            health: Math.ceil(cfg.health * healthMult),
            maxHealth: Math.ceil(cfg.health * healthMult),
            speed: cfg.speed * speedMult,
            score: cfg.score,
            coin: cfg.coin,
            color: cfg.color,
            fireRate: cfg.fireRate / (1 + (difficulty - 1) * 0.2),
            fireTimer: Math.random() * cfg.fireRate,
            behavior: cfg.behavior,
            startX: x,
            time: 0,
            
            update(dt) {
                this.time += dt;
                
                switch (this.behavior) {
                    case 'straight':
                        this.y += this.speed * dt;
                        break;
                    case 'zigzag':
                        this.y += this.speed * dt;
                        this.x = this.startX + Math.sin(this.time * 2) * 60;
                        break;
                    case 'spread':
                        this.y += this.speed * dt;
                        break;
                    case 'homing':
                        this.y += this.speed * 0.7 * dt;
                        const dx = player.x - this.x;
                        this.x += Math.sign(dx) * this.speed * 0.3 * dt;
                        break;
                    case 'boss':
                        if (this.y < gameHeight * 0.2) {
                            this.y += this.speed * dt;
                        } else {
                            this.x = this.startX + Math.sin(this.time * 0.8) * (gameWidth * 0.35);
                        }
                        break;
                    case 'charge':
                        this.y += this.speed * dt;
                        this.x += Math.sign(player.x - this.x) * this.speed * 0.5 * dt;
                        break;
                    case 'sniper':
                        this.y += this.speed * 0.3 * dt;
                        this.x = Math.max(this.width / 2, Math.min(gameWidth - this.width / 2, this.x + Math.sign(player.x - this.x) * this.speed * 0.2 * dt));
                        break;
                    case 'destroyer':
                        this.y += this.speed * dt;
                        break;
                    case 'stealth':
                        this.y += this.speed * dt;
                        this.alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 1.5));
                        break;
                }
                
                if (this.fireRate > 0) {
                    this.fireTimer += dt;
                    if (this.fireTimer >= this.fireRate) {
                        this.fire();
                        this.fireTimer = 0;
                    }
                }
            },
            
            fire() {
                switch (this.behavior) {
                    case 'charge':
                        const chargeAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        enemyBullets.push({
                            x: this.x,
                            y: this.y + this.height / 2,
                            width: 5,
                            height: 12,
                            vx: Math.cos(chargeAngle) * 400,
                            vy: Math.sin(chargeAngle) * 400,
                            damage: 8,
                            color: '#ff6600'
                        });
                        break;
                    case 'sniper':
                        const sniperAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        enemyBullets.push({
                            x: this.x,
                            y: this.y + this.height / 2,
                            width: 6,
                            height: 14,
                            vx: Math.cos(sniperAngle) * 320,
                            vy: Math.sin(sniperAngle) * 320,
                            damage: 12,
                            color: '#00ccff'
                        });
                        break;
                    case 'destroyer':
                        for (let i = -2; i <= 2; i++) {
                            const destroyerAngle = Math.PI / 2 + i * 0.25;
                            enemyBullets.push({
                                x: this.x,
                                y: this.y + this.height / 2,
                                width: 7,
                                height: 10,
                                vx: Math.cos(destroyerAngle) * 220,
                                vy: Math.sin(destroyerAngle) * 220,
                                damage: 10,
                                color: '#ff8800'
                            });
                        }
                        break;
                    case 'stealth':
                        const stealthAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        enemyBullets.push({
                            x: this.x,
                            y: this.y + this.height / 2,
                            width: 6,
                            height: 10,
                            vx: Math.cos(stealthAngle) * 280,
                            vy: Math.sin(stealthAngle) * 280,
                            damage: 10,
                            color: '#aa00ff'
                        });
                        break;
                    case 'zigzag':
                        enemyBullets.push({
                            x: this.x,
                            y: this.y + this.height / 2,
                            width: 6,
                            height: 10,
                            vx: 0,
                            vy: 300,
                            damage: 10,
                            color: '#ff4466'
                        });
                        break;
                    case 'spread':
                        for (let i = -1; i <= 1; i++) {
                            const angle = Math.PI / 2 + i * 0.3;
                            enemyBullets.push({
                                x: this.x,
                                y: this.y + this.height / 2,
                                width: 6,
                                height: 10,
                                vx: Math.cos(angle) * 250,
                                vy: Math.sin(angle) * 250,
                                damage: 10,
                                color: '#44ff66'
                            });
                        }
                        break;
                    case 'homing':
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        enemyBullets.push({
                            x: this.x,
                            y: this.y + this.height / 2,
                            width: 8,
                            height: 8,
                            vx: Math.cos(angle) * 200,
                            vy: Math.sin(angle) * 200,
                            damage: 15,
                            color: '#cc44ff',
                            homing: true,
                            homingStrength: 2
                        });
                        break;
                    case 'boss':
                        const bulletCount = 8;
                        for (let i = 0; i < bulletCount; i++) {
                            const bossAngle = (Math.PI * 2 / bulletCount) * i + this.time * 0.5;
                            enemyBullets.push({
                                x: this.x,
                                y: this.y + this.height / 2,
                                width: 8,
                                height: 8,
                                vx: Math.cos(bossAngle) * 180,
                                vy: Math.sin(bossAngle) * 180,
                                damage: 12,
                                color: this.color
                            });
                        }
                        const aimAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        for (let i = -1; i <= 1; i++) {
                            enemyBullets.push({
                                x: this.x,
                                y: this.y + this.height / 2,
                                width: 10,
                                height: 10,
                                vx: Math.cos(aimAngle + i * 0.2) * 280,
                                vy: Math.sin(aimAngle + i * 0.2) * 280,
                                damage: 18,
                                color: '#ffdd00',
                                homing: this.type === 'boss',
                                homingStrength: 1.5
                            });
                        }
                        break;
                }
            }
        };
    }

    function onEnemyKilled(enemy) {
        killCount++;
        combo++;
        comboTimer = 2;
        
        const comboMult = Math.min(1 + combo * 0.1, 3);
        const isCrit = Math.random() < 0.1;
        const critMult = isCrit ? 2 : 1;
        
        const earnedScore = Math.floor(enemy.score * comboMult * critMult);
        score += earnedScore;
        
        const earnedCoins = Math.floor(enemy.coin * player.coinMultiplier);
        coins += earnedCoins;
        
        checkUnlocks();
        
        player.energy = Math.min(player.maxEnergy, player.energy + enemy.score * 0.05);
        
        createExplosion(enemy.x, enemy.y, enemy.color, 15 + enemy.maxHealth);
        shakeScreen(3 + enemy.maxHealth * 0.5);
        
        const dropChance = enemy.type === 'elite' || enemy.type === 'miniBoss' || enemy.type === 'boss' ? 0.9 : 0.3;
        if (Math.random() < dropChance) {
            dropPowerUp(enemy.x, enemy.y);
            if (enemy.type === 'boss' || enemy.type === 'miniBoss') {
                for (let i = 0; i < 3; i++) {
                    dropPowerUp(enemy.x + (Math.random() - 0.5) * 100, enemy.y + (Math.random() - 0.5) * 50);
                }
            }
        }
        
        if (currentMode === 'classic') {
            if (enemy.type === 'boss' || enemy.type === 'miniBoss') {
                levelComplete = true;
            } else {
                levelKills++;
            }
        } else if (currentMode === 'bossrush') {
            if (enemy.type === 'boss' || enemy.type === 'miniBoss') {
                // 击败 Boss 恢复 30% 最大生命值
                player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.3);

                bossRushIndex++;
                if (bossRushIndex >= 5) {
                    showBossRushVictory();
                } else {
                    spawnBossRush();
                }
            }
        }
    }

    function dropPowerUp(x, y) {
        const types = ['weaponUp', 'shield', 'heal', 'energy', 'slowTime', 'coinBoost', 'invincible', 'wingman'];
        const weights = [25, 15, 15, 10, 10, 10, 5, 10];
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalWeight;
        let type = types[0];
        
        for (let i = 0; i < types.length; i++) {
            rand -= weights[i];
            if (rand <= 0) {
                type = types[i];
                break;
            }
        }
        
        powerUps.push({
            x,
            y,
            width: 28,
            height: 28,
            speed: 80,
            type,
            rotation: 0
        });
    }

    function applyPowerUp(type) {
        audioManager.playPowerUp();
        switch (type) {
            case 'weaponUp':
                if (player.weaponLevel < 5) {
                    player.weaponLevel++;
                } else {
                    if (player.weaponType === 'single') {
                        player.weaponType = 'spread';
                        player.weaponLevel = 1;
                    }
                }
                createFloatText(player.x, player.y - 40, '武器升级!', '#00d4ff');
                break;
            case 'shield':
                player.shield = true;
                createFloatText(player.x, player.y - 40, '护盾!', '#00d4ff');
                break;
            case 'heal':
                player.health = Math.min(player.maxHealth, player.health + 30);
                createFloatText(player.x, player.y - 40, '+30 HP', '#00ff88');
                break;
            case 'energy':
                player.energy = player.maxEnergy;
                createFloatText(player.x, player.y - 40, '能量充满!', '#ff00ff');
                break;
            case 'slowTime':
                player.slowTimeActive = true;
                player.slowTimeTimer = 5;
                slowMotion = 0.5;
                createFloatText(player.x, player.y - 40, '时间减速!', '#00d4ff');
                break;
            case 'coinBoost':
                player.coinMultiplier = 2;
                setTimeout(() => { player.coinMultiplier = 1; }, 10000);
                createFloatText(player.x, player.y - 40, '金币x2!', '#ffd700');
                break;
            case 'invincible':
                player.invincible = true;
                player.invincibleTimer = 3;
                createFloatText(player.x, player.y - 40, '无敌!', '#ffd700');
                break;
            case 'wingman':
                if (player.wingmen.length < 2) {
                    player.wingmen.push({
                        side: player.wingmen.length === 0 ? -1 : 1,
                        timer: 8,
                        fireTimer: 0
                    });
                }
                createFloatText(player.x, player.y - 40, '僚机!', '#00ff88');
                break;
        }
        
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 0.5,
                maxLife: 0.5,
                size: 4,
                color: '#ffd700'
            });
        }
    }

    function useUltimate() {
        if (player.energy < player.maxEnergy) return;

        audioManager.playUltimate();
        player.energy = 0;
        player.invincible = true;
        player.invincibleTimer = 1.5;

        shakeScreen(15);
        slowMotion = 0.3;
        setTimeout(() => { slowMotion = player.slowTimeActive ? 0.5 : 1; }, 300);

        switch (currentShip) {
            case 'thunder':
                useThunderUltimate();
                break;
            case 'phantom':
                usePhantomUltimate();
                break;
            case 'fortress':
                useFortressUltimate();
                break;
            case 'meteor':
                useMeteorUltimate();
                break;
            default:
                useFalconUltimate();
                break;
        }
    }

    function useFalconUltimate() {
        // 猎鹰号：标准全屏爆发（技能描述为“无”，保留基础大招）
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.health -= 60;
            createExplosion(e.x, e.y, e.color, 20);
        }
        enemyBullets = [];
        createFloatText(player.x, player.y - 50, '全屏爆发!', '#00d4ff');

        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 400 + 100;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 1,
                size: Math.random() * 8 + 4,
                color: Math.random() > 0.5 ? '#00d4ff' : '#ff00ff'
            });
        }
    }

    function useThunderUltimate() {
        // 雷霆号：闪电链，对每个敌人造成伤害并连锁附近敌人
        const chained = new Set();
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (chained.has(e)) continue;

            const damage = 80;
            e.health -= damage;
            chained.add(e);

            // 连锁到最近的 2 个敌人
            const others = enemies.filter(oe => oe !== e && !chained.has(oe));
            others.sort((a, b) => {
                const da = (a.x - e.x) ** 2 + (a.y - e.y) ** 2;
                const db = (b.x - e.x) ** 2 + (b.y - e.y) ** 2;
                return da - db;
            });

            for (let j = 0; j < Math.min(2, others.length); j++) {
                const target = others[j];
                target.health -= damage * 0.6;
                chained.add(target);
                createLightning(e.x, e.y, target.x, target.y);
            }

            createLightning(player.x, player.y, e.x, e.y);
            createExplosion(e.x, e.y, '#ffdd00', 15);
        }
        enemyBullets = [];
        createFloatText(player.x, player.y - 50, '闪电链!', '#ffdd00');
    }

    function createLightning(x1, y1, x2, y2) {
        const segments = 8;
        const dx = (x2 - x1) / segments;
        const dy = (y2 - y1) / segments;
        let px = x1;
        let py = y1;
        for (let i = 0; i < segments; i++) {
            const nx = x1 + dx * (i + 1) + (Math.random() - 0.5) * 30;
            const ny = y1 + dy * (i + 1) + (Math.random() - 0.5) * 30;
            particles.push({
                x: (px + nx) / 2,
                y: (py + ny) / 2,
                vx: 0,
                vy: 0,
                life: 0.3,
                maxLife: 0.3,
                size: 3,
                color: '#ffdd00',
                isLightning: true,
                lx: px,
                ly: py,
                lnx: nx,
                lny: ny
            });
            px = nx;
            py = ny;
        }
    }

    function usePhantomUltimate() {
        // 幻影号：隐身闪避 5 秒，期间无敌且移速大幅提升
        player.stealthActive = true;
        player.stealthTimer = 5;
        player.stealthSpeedBonus = player.speed * 0.5;
        player.invincible = true;
        player.invincibleTimer = 5;
        enemyBullets = [];
        createFloatText(player.x, player.y - 50, '隐身闪避!', '#ff00ff');

        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                maxLife: 0.8,
                size: Math.random() * 6 + 2,
                color: '#ff00ff'
            });
        }
    }

    function useFortressUltimate() {
        // 堡垒号：重型护盾 + 高爆弹头
        player.shield = true;
        enemyBullets = [];
        createFloatText(player.x, player.y - 50, '重型护盾!', '#00ff88');

        // 发射 3 发高爆弹，穿透并造成高额范围伤害
        for (let i = -1; i <= 1; i++) {
            playerBullets.push({
                x: player.x + i * 30,
                y: player.y - player.height / 2,
                width: 14,
                height: 20,
                vx: i * 80,
                vy: -500,
                damage: 15,
                color: '#00ff88',
                type: 'mega',
                pierce: 99,
                explosionRadius: 80
            });
        }

        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 300 + 100;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                maxLife: 0.8,
                size: Math.random() * 8 + 3,
                color: '#00ff88'
            });
        }
    }

    function useMeteorUltimate() {
        // 星陨号：陨石轰击，召唤 5 颗陨石造成高额范围伤害
        for (let i = 0; i < 5; i++) {
            const targetX = Math.random() * (gameWidth - 100) + 50;
            meteors.push({
                x: targetX,
                y: -100 - Math.random() * 200,
                targetX: targetX,
                targetY: gameHeight + 100,
                speed: 400 + Math.random() * 200,
                damage: 200,
                radius: 60,
                color: '#ff8800',
                active: true
            });
        }
        createFloatText(player.x, player.y - 50, '陨石轰击!', '#ff8800');
        enemyBullets = [];

        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 300 + 100;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 1,
                size: Math.random() * 10 + 4,
                color: '#ff8800'
            });
        }
    }

    function checkCollisions() {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const b = playerBullets[i];
            let bulletHit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (aabbCollision(b, e)) {
                    e.health -= b.damage;
                    createHitSpark(b.x, b.y, e.color);

                    // 高爆弹头范围伤害
                    if (b.explosionRadius) {
                        for (let k = enemies.length - 1; k >= 0; k--) {
                            if (k === j) continue;
                            const oe = enemies[k];
                            const dx = oe.x - b.x;
                            const dy = oe.y - b.y;
                            if (dx * dx + dy * dy <= b.explosionRadius * b.explosionRadius) {
                                oe.health -= b.damage * 0.5;
                                if (oe.health <= 0) {
                                    onEnemyKilled(oe);
                                    enemies.splice(k, 1);
                                    if (k < j) j--;
                                }
                            }
                        }
                        createExplosion(b.x, b.y, b.color, 15);
                    }

                    if (e.health <= 0) {
                        onEnemyKilled(e);
                        enemies.splice(j, 1);
                    }

                    if (b.pierce && b.pierce > 0) {
                        b.pierce--;
                    } else {
                        bulletHit = true;
                        break;
                    }
                }
            }
            if (bulletHit) {
                playerBullets.splice(i, 1);
            }
        }
        
        if (!player.invincible) {
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const b = enemyBullets[i];
                if (circleCollision(b.x, b.y, b.width / 2, player.x, player.y, player.width / 3)) {
                    enemyBullets.splice(i, 1);
                    damagePlayer(b.damage);
                    break;
                }
            }
        }
        
        // 幻影号隐身状态下碰撞敌人会闪避并反伤
        if (player.stealthActive) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (aabbCollision(
                    { x: e.x - e.width / 2, y: e.y - e.height / 2, width: e.width, height: e.height },
                    { x: player.x - player.width / 3, y: player.y - player.height / 3, width: player.width * 2 / 3, height: player.height * 2 / 3 }
                )) {
                    e.health -= 100;
                    createFloatText(player.x, player.y - 40, '闪避!', '#ff00ff');
                    createExplosion(e.x, e.y, '#ff00ff', 15);
                    if (e.health <= 0) {
                        onEnemyKilled(e);
                        enemies.splice(i, 1);
                    }
                }
            }
        } else if (!player.invincible) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (aabbCollision(
                    { x: e.x - e.width / 2, y: e.y - e.height / 2, width: e.width, height: e.height },
                    { x: player.x - player.width / 3, y: player.y - player.height / 3, width: player.width * 2 / 3, height: player.height * 2 / 3 }
                )) {
                    damagePlayer(20);
                    e.health -= 5;
                    if (e.health <= 0) {
                        onEnemyKilled(e);
                        enemies.splice(i, 1);
                    }
                    break;
                }
            }
        }
        
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            if (circleCollision(p.x, p.y, p.width / 2, player.x, player.y, player.width / 2)) {
                applyPowerUp(p.type);
                powerUps.splice(i, 1);
            }
        }
        
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const b = enemyBullets[i];
            if (b.homing) {
                const angle = Math.atan2(player.y - b.y, player.x - b.x);
                const currentAngle = Math.atan2(b.vy, b.vx);
                const newAngle = currentAngle + (angle - currentAngle) * 0.02 * b.homingStrength;
                const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                b.vx = Math.cos(newAngle) * speed;
                b.vy = Math.sin(newAngle) * speed;
            }
        }
    }

    function damagePlayer(amount) {
        if (player.shield) {
            player.shield = false;
            createShieldBreak();
            shakeScreen(10);
            return;
        }
        
        if (currentShip === 'phantom' && Math.random() < 0.3) {
            createFloatText(player.x, player.y - 40, '闪避!', '#ff00ff');
            return;
        }
        
        player.health -= amount;
        shakeScreen(8);
        player.invincible = true;
        player.invincibleTimer = 0.5;

        audioManager.playHit();
        createExplosion(player.x, player.y, '#ff4466', 10);

        if (player.health <= 0) {
            if (player.reviveCount > 0) {
                player.reviveCount--;
                player.health = Math.floor(player.maxHealth * 0.5);
                player.invincible = true;
                player.invincibleTimer = 2;
                createFloatText(player.x, player.y - 50, '复活十字架!', '#ffd700');
                createExplosion(player.x, player.y, '#ffd700', 30);
                shakeScreen(15);
                return;
            }

            player.health = 0;
            createExplosion(player.x, player.y, '#ff8800', 40);
            shakeScreen(25);
            setTimeout(gameOver, 500);
        }
    }

    function aabbCollision(a, b) {
        const ax = a.x - (a.width || 0) / 2;
        const ay = a.y - (a.height || 0) / 2;
        const aw = a.width || 0;
        const ah = a.height || 0;
        
        const bx = b.x - (b.width || 0) / 2;
        const by = b.y - (b.height || 0) / 2;
        const bw = b.width || 0;
        const bh = b.height || 0;
        
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function circleCollision(x1, y1, r1, x2, y2, r2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < r1 + r2;
    }

    function updateCombo(dt) {
        if (combo > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                combo = 0;
            }
        }
    }

    function createExplosion(x, y, color, count = 20) {
        audioManager.playExplosion();
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 0.5 + 0.3,
                maxLife: 0.8,
                size: Math.random() * 6 + 2,
                color
            });
        }
    }

    function createHitSpark(x, y, color) {
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 100 + 30;
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.2,
                maxLife: 0.2,
                size: Math.random() * 3 + 1,
                color
            });
        }
    }

    function createEngineParticle() {
        particles.push({
            x: player.x + (Math.random() - 0.5) * 10,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 30,
            vy: 100 + Math.random() * 50,
            life: 0.3,
            maxLife: 0.3,
            size: Math.random() * 4 + 2,
            color: '#00d4ff'
        });
        
        for (let wm of player.wingmen) {
            const wmX = player.x + wm.side * 40;
            const wmY = player.y + 10;
            wm.x = wmX;
            wm.y = wmY;
            particles.push({
                x: wmX + (Math.random() - 0.5) * 6,
                y: wmY + 12,
                vx: (Math.random() - 0.5) * 20,
                vy: 80 + Math.random() * 30,
                life: 0.25,
                maxLife: 0.25,
                size: Math.random() * 3 + 1,
                color: '#00ff88'
            });
        }
    }

    function createShieldBreak() {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 50;
            particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5,
                maxLife: 0.5,
                size: Math.random() * 5 + 2,
                color: '#00d4ff'
            });
        }
    }

    function createFloatText(x, y, text, color) {
        particles.push({
            x,
            y,
            vx: 0,
            vy: -50,
            life: 1,
            maxLife: 1,
            size: 0,
            color,
            text,
            isText: true
        });
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            
            if (!p.isText) {
                p.vx *= 0.98;
                p.vy *= 0.98;
            }
            
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function shakeScreen(amount) {
        shakeAmount = Math.max(shakeAmount, amount);
    }

    function render() {
        ctx.clearRect(0, 0, gameWidth, gameHeight);
        
        ctx.save();
        
        if (shakeAmount > 0) {
            ctx.translate(
                (Math.random() - 0.5) * shakeAmount,
                (Math.random() - 0.5) * shakeAmount
            );
        }
        
        drawBackground();
        drawStars();
        
        if (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover') {
            drawPowerUps();
            drawEnemies();
            drawMeteors();
            drawPlayer();
            drawBullets();
        } else if (gameState === 'menu' || gameState === 'modeSelect' || gameState === 'shipSelect' || gameState === 'shop') {
            drawMenuPlayer();
        }
        drawParticles();
        
        ctx.restore();
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.5, '#1a0a2e');
        gradient.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, gameWidth, gameHeight);
    }

    function drawStars() {
        for (let star of stars) {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);
        
        if (player.invincible && Math.floor(Date.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // 幻影号隐身效果：半透明 + 紫色残影
        if (player.stealthActive) {
            ctx.globalAlpha = 0.35;
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ff00ff';
        }

        const config = shipConfigs[currentShip] || shipConfigs.falcon;
        const color = config.color;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -player.height / 2);
        ctx.lineTo(-player.width / 2, player.height / 2);
        ctx.lineTo(-player.width / 4, player.height / 3);
        ctx.lineTo(player.width / 4, player.height / 3);
        ctx.lineTo(player.width / 2, player.height / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -player.height / 6, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-player.width / 2 - 4, 0, 6, player.height / 3);
        ctx.fillRect(player.width / 2 - 2, 0, 6, player.height / 3);
        ctx.globalAlpha = 1;
        
        ctx.shadowBlur = 0;
        
        if (player.shield) {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00d4ff';
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, player.width * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
        
        for (let wm of player.wingmen) {
            const wmX = wm.side * 40;
            const wmY = 10;
            ctx.fillStyle = '#00ff88';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ff88';
            ctx.beginPath();
            ctx.moveTo(wmX, wmY - 12);
            ctx.lineTo(wmX - 10, wmY + 8);
            ctx.lineTo(wmX + 10, wmY + 8);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        ctx.restore();
    }

    function drawMenuPlayer() {
        const y = gameHeight * 0.7;
        const x = gameWidth / 2 + Math.sin(Date.now() / 1000) * 30;
        
        ctx.save();
        ctx.translate(x, y);
        
        const config = shipConfigs[currentShip] || shipConfigs.falcon;
        const color = config.color;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.globalAlpha = 0.8;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(-24, 28);
        ctx.lineTo(-12, 18);
        ctx.lineTo(12, 18);
        ctx.lineTo(24, 28);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -5, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawEnemies() {
        for (let e of enemies) {
            ctx.save();
            ctx.translate(e.x, e.y);
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            
            if (e.type === 'scout') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, e.height / 2);
                ctx.lineTo(e.width / 2, e.height / 2);
                ctx.closePath();
                ctx.fill();
            } else if (e.type === 'fighter') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, 0);
                ctx.lineTo(-e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 2, 0);
                ctx.closePath();
                ctx.fill();
            } else if (e.type === 'bomber') {
                ctx.beginPath();
                ctx.ellipse(0, 0, e.width / 2, e.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#115533';
                ctx.fillRect(-e.width / 2 - 6, -4, 8, 8);
                ctx.fillRect(e.width / 2 - 2, -4, 8, 8);
            } else if (e.type === 'elite') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, -e.height / 4);
                ctx.lineTo(-e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 2, -e.height / 4);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2 - 6);
                ctx.lineTo(-5, -e.height / 2 + 2);
                ctx.lineTo(5, -e.height / 2 + 2);
                ctx.closePath();
                ctx.fill();
            } else if (e.type === 'interceptor') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, e.height / 4);
                ctx.lineTo(-e.width / 4, e.height / 2);
                ctx.lineTo(0, e.height / 3);
                ctx.lineTo(e.width / 4, e.height / 2);
                ctx.lineTo(e.width / 2, e.height / 4);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(-3, -e.height / 4, 6, e.height / 2);
            } else if (e.type === 'sniper') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, 0);
                ctx.lineTo(-e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, -e.height / 4, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'destroyer') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, -e.height / 6);
                ctx.lineTo(-e.width / 2, e.height / 3);
                ctx.lineTo(0, e.height / 2);
                ctx.lineTo(e.width / 2, e.height / 3);
                ctx.lineTo(e.width / 2, -e.height / 6);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#552200';
                ctx.fillRect(-e.width / 4, -e.height / 4, e.width / 2, e.height / 2);
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'stealth') {
                ctx.globalAlpha = e.alpha || 0.6;
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, 0);
                ctx.lineTo(0, e.height / 2);
                ctx.lineTo(e.width / 2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (e.type === 'miniBoss' || e.type === 'boss') {
                ctx.beginPath();
                ctx.moveTo(0, -e.height / 2);
                ctx.lineTo(-e.width / 2, -e.height / 6);
                ctx.lineTo(-e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 3, e.height / 2);
                ctx.lineTo(e.width / 2, -e.height / 6);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#111122';
                ctx.beginPath();
                ctx.ellipse(0, -e.height / 8, e.width / 4, e.height / 4, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#ffdd00';
                ctx.beginPath();
                ctx.arc(0, -e.height / 8, e.width / 8, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = e.color;
                ctx.fillRect(-e.width / 2 - 10, -e.height / 6, 12, e.height / 3);
                ctx.fillRect(e.width / 2 - 2, -e.height / 6, 12, e.height / 3);
                
                if (e.type === 'boss') {
                    ctx.fillStyle = '#ffdd00';
                    ctx.beginPath();
                    ctx.moveTo(0, -e.height / 2 - 15);
                    ctx.lineTo(-12, -e.height / 2 + 5);
                    ctx.lineTo(12, -e.height / 2 + 5);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(-e.width / 3, -e.height / 2 - 8);
                    ctx.lineTo(-e.width / 3 - 8, -e.height / 2 + 8);
                    ctx.lineTo(-e.width / 3 + 8, -e.height / 2 + 8);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(e.width / 3, -e.height / 2 - 8);
                    ctx.lineTo(e.width / 3 - 8, -e.height / 2 + 8);
                    ctx.lineTo(e.width / 3 + 8, -e.height / 2 + 8);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            
            ctx.shadowBlur = 0;
            
            if (e.maxHealth > 3) {
                const barWidth = e.width;
                const barHeight = 4;
                const barY = -e.height / 2 - 8;
                
                ctx.fillStyle = 'rgba(255, 34, 68, 0.3)';
                ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
                
                ctx.fillStyle = '#ff2244';
                ctx.fillRect(-barWidth / 2, barY, barWidth * (e.health / e.maxHealth), barHeight);
            }
            
            ctx.restore();
        }
    }

    function drawMeteors() {
        for (let m of meteors) {
            ctx.save();
            ctx.translate(m.x, m.y);

            ctx.shadowBlur = 20;
            ctx.shadowColor = m.color;
            ctx.fillStyle = m.color;

            // 陨石本体
            ctx.beginPath();
            ctx.arc(0, 0, m.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // 陨石尾焰
            const gradient = ctx.createLinearGradient(0, -m.radius, 0, m.radius * 1.5);
            gradient.addColorStop(0, 'rgba(255, 136, 0, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 68, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(-m.radius * 0.3, 0);
            ctx.lineTo(0, -m.radius * 2);
            ctx.lineTo(m.radius * 0.3, 0);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    function drawBullets() {
        for (let b of playerBullets) {
            ctx.save();
            ctx.translate(b.x, b.y);
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = b.color;
            ctx.fillStyle = b.color;
            
            const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
            ctx.rotate(angle);
            
            if (b.type === 'mega') {
                // 高爆弹头：更大的弹体 + 核心光晕
                ctx.beginPath();
                ctx.arc(0, 0, b.width, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, b.width * 0.4, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 0.3;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(0, 0, b.explosionRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.ellipse(0, 0, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(0, b.height / 2, b.width / 3, b.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        
        for (let b of enemyBullets) {
            ctx.save();
            ctx.translate(b.x, b.y);
            
            ctx.shadowBlur = 8;
            ctx.shadowColor = b.color;
            ctx.fillStyle = b.color;
            
            ctx.beginPath();
            ctx.arc(0, 0, b.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }

    function drawPowerUps() {
        for (let p of powerUps) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            
            const colors = {
                weaponUp: '#00d4ff',
                shield: '#00d4ff',
                heal: '#00ff88',
                energy: '#ff00ff',
                slowTime: '#00d4ff',
                coinBoost: '#ffd700',
                invincible: '#ffd700',
                wingman: '#00ff88'
            };
            
            const color = colors[p.type] || '#ffffff';
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(10, 20, 40, 0.8)';
            
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
                const x = Math.cos(angle) * 14;
                const y = Math.sin(angle) * 14;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.rotate(-p.rotation);
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const icons = {
                weaponUp: '🔫',
                shield: '🛡',
                heal: '❤',
                energy: '⚡',
                slowTime: '⏱',
                coinBoost: '💰',
                invincible: '⭐',
                wingman: '🚀'
            };
            
            ctx.fillText(icons[p.type] || '?', 0, 1);
            
            ctx.restore();
        }
    }

    function drawParticles() {
        for (let p of particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            
            if (p.isText) {
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.fillText(p.text, p.x, p.y);
                ctx.shadowBlur = 0;
            } else if (p.isLightning) {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 15;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.moveTo(p.lx, p.ly);
                ctx.lineTo(p.lnx, p.lny);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 5;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        ctx.globalAlpha = 1;
    }

    function updateHUD() {
        const healthPercent = (player.health / player.maxHealth) * 100;
        document.getElementById('healthFill').style.width = healthPercent + '%';
        document.getElementById('healthText').textContent = Math.ceil(player.health) + '/' + player.maxHealth;
        
        if (healthPercent < 30) {
            document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #ff2244, #ff8800)';
        } else {
            document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #00ff88, #00dd66)';
        }
        
        document.getElementById('scoreText').textContent = score.toLocaleString();
        document.getElementById('coinText').textContent = coins.toLocaleString();
        document.getElementById('highScoreText').textContent = (gameData.highScore[currentMode] || 0).toLocaleString();
        
        const energyPercent = (player.energy / player.maxEnergy) * 100;
        document.getElementById('energyFill').style.width = energyPercent + '%';
        document.getElementById('energyText').textContent = Math.floor(energyPercent) + '%';
        
        document.getElementById('weaponLevelText').textContent = 'Lv.' + player.weaponLevel;
        
        const shieldEl = document.getElementById('shieldIndicator');
        if (player.shield) {
            shieldEl.classList.remove('hidden');
        } else {
            shieldEl.classList.add('hidden');
        }
        
        const comboEl = document.getElementById('comboDisplay');
        if (combo >= 3) {
            comboEl.classList.remove('hidden');
            document.getElementById('comboText').textContent = '连击 x' + combo;
        } else {
            comboEl.classList.add('hidden');
        }
        
        updateWaveProgress();
    }
    
    function updateWaveProgress() {
        const waveLabel = document.getElementById('waveLabel');
        const waveFill = document.getElementById('waveFill');
        const waveText = document.getElementById('waveText');
        
        let progress = 0;
        let label = '';
        let text = '';
        
        switch (currentMode) {
            case 'endless':
                const wavesPerStage = 10;
                const currentStage = Math.floor(waveNumber / wavesPerStage) + 1;
                const waveInStage = (waveNumber % wavesPerStage) + 1;
                progress = (waveInStage / wavesPerStage) * 100;
                label = '阶段 ' + currentStage;
                text = waveInStage + '/' + wavesPerStage;
                break;
            case 'classic':
                const totalClassicLevels = 10;
                const classicLevel = Math.min(currentLevel, totalClassicLevels);
                if (bossSpawned) {
                    const boss = enemies.find(e => e.type === 'boss' || e.type === 'miniBoss');
                    if (boss) {
                        progress = (boss.health / boss.maxHealth) * 100;
                        label = currentLevel === 10 ? '最终Boss' : '小Boss';
                        text = Math.ceil(boss.health) + '/' + boss.maxHealth;
                    } else {
                        progress = 100;
                        label = '关卡 ' + classicLevel;
                        text = '已完成';
                    }
                } else {
                    progress = (levelKills / levelKillsRequired) * 100;
                    label = '关卡 ' + classicLevel;
                    text = levelKills + '/' + levelKillsRequired;
                }
                break;
            case 'challenge':
                const challengeTime = 60;
                const elapsed = (Date.now() - gameStartTime) / 1000;
                const remaining = Math.max(0, challengeTime - elapsed);
                progress = (remaining / challengeTime) * 100;
                label = '剩余时间';
                text = Math.ceil(remaining) + 's';
                break;
            case 'bossrush':
                const totalBosses = 5;
                const boss = enemies.find(e => e.type === 'boss' || e.type === 'miniBoss');
                const currentBoss = Math.min(bossRushIndex + 1, totalBosses);
                if (boss) {
                    progress = (boss.health / boss.maxHealth) * 100;
                    label = 'Boss ' + currentBoss + '/' + totalBosses;
                    text = Math.ceil(boss.health) + '/' + boss.maxHealth;
                } else {
                    progress = (currentBoss / totalBosses) * 100;
                    label = 'Boss';
                    text = currentBoss + '/' + totalBosses;
                }
                break;
            default:
                progress = 0;
                label = '波次';
                text = '0/10';
        }
        
        waveLabel.textContent = label;
        waveFill.style.width = progress + '%';
        waveText.textContent = text;
    }

    function updateLeaderboard(mode) {
        const container = document.getElementById('leaderboardEntries');
        const highScore = gameData.highScore[mode] || 0;
        
        if (highScore === 0) {
            container.innerHTML = '<p class="empty-text">暂无记录，快去创造纪录吧！</p>';
            return;
        }
        
        const mockData = [
            { rank: 1, score: highScore, date: '今天' }
        ];
        
        let html = '';
        for (let entry of mockData) {
            const rankClass = entry.rank <= 3 ? 'rank-' + entry.rank : '';
            html += `
                <div class="leaderboard-entry">
                    <span class="rank ${rankClass}">${entry.rank}</span>
                    <span class="score-value">${entry.score.toLocaleString()}</span>
                    <span>${entry.date}</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    function loadGameData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                gameData = deepMerge(gameData, parsed);

                // 兼容旧版存档：把驼峰 bossRush 映射到全小写 bossrush
                if (parsed.highScore && typeof parsed.highScore.bossRush === 'number') {
                    gameData.highScore.bossrush = Math.max(
                        gameData.highScore.bossrush || 0,
                        parsed.highScore.bossRush
                    );
                }
            }
        } catch (e) {
            console.log('Failed to load game data');
        }
    }

    function deepMerge(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    function unlockShip(shipKey) {
        if (!gameData.unlockedShips.includes(shipKey)) {
            gameData.unlockedShips.push(shipKey);
            saveGameData();
            const names = {
                falcon: '猎鹰号',
                thunder: '雷霆号',
                phantom: '幻影号',
                fortress: '堡垒号',
                meteor: '星陨号'
            };
            showUnlockNotification(names[shipKey] || shipKey);
        }
    }
    
    function showUnlockNotification(shipName) {
        const existing = document.getElementById('unlockNotice');
        if (existing) existing.remove();
        
        const notice = document.createElement('div');
        notice.id = 'unlockNotice';
        notice.className = 'unlock-notice';
        notice.innerHTML = `
            <div class="unlock-inner">
                <div class="unlock-title">🎉 新战机解锁</div>
                <div class="unlock-ship">${shipName}</div>
                <div class="unlock-tip">可以在战机选择界面使用啦！</div>
            </div>
        `;
        document.getElementById('gameContainer').appendChild(notice);
        setTimeout(() => {
            notice.classList.add('show');
        }, 50);
        setTimeout(() => {
            notice.classList.remove('show');
            setTimeout(() => notice.remove(), 500);
        }, 3500);
    }
    
    function checkUnlocks() {
        if (currentMode === 'classic') {
            if (currentLevel >= 5 && levelComplete && currentLevel < 6) {
                unlockShip('thunder');
            }
        }
        if (currentMode === 'endless' && score >= 5000) {
            unlockShip('phantom');
        }
        if (gameData.coins + coins >= 2000) {
            unlockShip('meteor');
        }
    }
    
    function updateShipLockUI() {
        document.querySelectorAll('.ship-card').forEach(card => {
            const ship = card.dataset.ship;
            if (gameData.unlockedShips.includes(ship)) {
                card.classList.remove('locked');
                const lockText = card.querySelector('.lock-text');
                if (lockText) lockText.remove();
            } else {
                card.classList.add('locked');
            }
        });
    }
    
    function showShipSelect() {
        updateShipLockUI();
        gameState = 'shipSelect';
        hideAllScreens();
        document.getElementById('shipSelect').classList.remove('hidden');
    }
    
    function saveGameData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
        } catch (e) {
            console.log('Failed to save game data');
        }
    }

    // 暴露关键状态到 window，方便自动化测试和调试（不影响正常游戏）
    window.__gameDebug = {
        get gameState() { return gameState; },
        get currentMode() { return currentMode; },
        get currentShip() { return currentShip; },
        get score() { return score; },
        get coins() { return coins; },
        get gameData() { return gameData; },
        get killCount() { return killCount; },
        get combo() { return combo; },
        get difficulty() { return difficulty; },
        get spawnInterval() { return spawnInterval; },
        get waveNumber() { return waveNumber; },
        get enemies() { return enemies; },
        get playerBullets() { return playerBullets; },
        get enemyBullets() { return enemyBullets; },
        get player() { return player; },
        get particles() { return particles; },
        get powerUps() { return powerUps; },
        get meteors() { return meteors; },
        // 调试辅助：手动推进游戏循环（用于后台标签页测试）
        step: function(dt) {
            if (gameState === 'playing') {
                update(dt);
                render();
            }
        },
        // 调试辅助：强制生成指定类型敌人
        spawn: function(type, x, y) {
            const ex = x || Math.random() * (gameWidth - 60) + 30;
            const ey = y || -30;
            enemies.push(createEnemy(type, ex, ey));
            return enemies[enemies.length - 1];
        },
        // 调试辅助：切换游戏状态
        setState: function(newState) {
            gameState = newState;
        },
        // 调试辅助：强制结束游戏（用于测试金币存储等）
        forceGameOver: function() {
            gameOver();
        },
        // 调试辅助：增加本局金币（用于测试金币存储）
        addCoins: function(amount) {
            coins += amount;
        }
    };

    init();
})();