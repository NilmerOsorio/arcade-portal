/* ==========================================================================
   NEON SNAKE — Retro Arcade
   Project 08 · Vanilla JavaScript game engine

   Responsibilities:
   - Grid-based snake kinematics with interpolated (smooth) rendering
   - Buffered directional input with anti-reverse logic
   - Random food spawning, growth and scoring
   - Wall / self collision detection and game-over flow
   - Custom audio FX for scoring and losing
   - High-score persistence via localStorage
   - Start / Playing / Paused / Game Over UI state machine
   ========================================================================== */

(() => {
    'use strict';

    /* ----------------------------------------------------------------------
       Configuration
       ---------------------------------------------------------------------- */
    const COLS = 20;
    const ROWS = 20;
    const CELL = 24;
    const BOARD = COLS * CELL;

    const CONFIG = {
        startLength: 4,
        scorePerFood: 10,
        startStep: 140,      // ms per grid step at the beginning
        minStep: 72,         // fastest the snake will ever move
        speedUpPerFood: 4,   // ms shaved off per fruit eaten
        deathDelay: 700,     // ms before the game-over card appears
    };

    const STORAGE = {
        highScore: 'snake.highScore.v1',
        muted: 'snake.muted.v1',
    };

    const DIR = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    };

    const KEY_DIRECTIONS = {
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
    };

    const COLOR = {
        food: '#ffc857',
        foodCore: '#fff6d8',
        grid: 'rgba(77, 255, 158, 0.05)',
        gridAccent: 'rgba(255, 255, 255, 0.014)',
        frame: 'rgba(77, 255, 158, 0.16)',
        danger: '255, 61, 154',
    };

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ----------------------------------------------------------------------
       Tiny DOM helpers
       ---------------------------------------------------------------------- */
    const $ = (id) => document.getElementById(id);

    function restartAnimation(el, className) {
        el.classList.remove(className);
        // Force reflow so the animation can be re-triggered.
        void el.offsetWidth;
        el.classList.add(className);
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    /* ----------------------------------------------------------------------
       Audio FX
       Custom clips live in assets/audio/ (with a flat assets/ fallback).
       Each clip is pooled so rapid repeats (eating) never cut each other off.
       ---------------------------------------------------------------------- */
    const AudioFX = (() => {
        const CLIPS = {
            eat: {
                primary: 'assets/audio/scoring_points.mp3',
                fallback: 'assets/scoring_points.mp3',
                volume: 0.55,
                poolSize: 3,
            },
            lose: {
                primary: 'assets/audio/game_over.mp3',
                fallback: 'assets/game_over.mp3',
                volume: 0.7,
                poolSize: 1,
            },
        };

        const pools = {};
        let muted = readMuted();
        let unlocked = false;

        function readMuted() {
            try {
                return localStorage.getItem(STORAGE.muted) === 'true';
            } catch (error) {
                return false;
            }
        }

        function writeMuted(value) {
            try {
                localStorage.setItem(STORAGE.muted, String(value));
            } catch (error) {
                /* Storage may be unavailable (private mode) — sound still works. */
            }
        }

        function createPool(clip) {
            if (typeof Audio === 'undefined') {
                return { elements: [], index: 0 };
            }

            const elements = [];

            for (let i = 0; i < clip.poolSize; i += 1) {
                const audio = new Audio();
                audio.preload = 'auto';
                audio.volume = clip.volume;

                // Try the spec path first, then the flat assets/ path.
                audio.addEventListener('error', () => {
                    if (audio.dataset.fallbackApplied === 'true') return;
                    audio.dataset.fallbackApplied = 'true';
                    audio.src = clip.fallback;
                    audio.load();
                });

                audio.src = clip.primary;
                elements.push(audio);
            }

            return { elements, index: 0 };
        }

        function init() {
            Object.entries(CLIPS).forEach(([key, clip]) => {
                pools[key] = createPool(clip);
            });
        }

        function play(name) {
            if (muted) return;

            const pool = pools[name];
            if (!pool || pool.elements.length === 0) return;

            const audio = pool.elements[pool.index];
            pool.index = (pool.index + 1) % pool.elements.length;

            try {
                audio.currentTime = 0;
                const attempt = audio.play();
                if (attempt && typeof attempt.catch === 'function') {
                    attempt.catch(() => {
                        /* Autoplay policy or a missing file — ignore silently. */
                    });
                }
            } catch (error) {
                /* Older browsers throw synchronously; never break gameplay. */
            }
        }

        /**
         * Browsers block audio until a user gesture. Playing each pooled clip
         * muted once "unlocks" them for the rest of the session.
         */
        function unlock() {
            if (unlocked) return;
            unlocked = true;

            Object.values(pools).forEach((pool) => {
                pool.elements.forEach((audio) => {
                    const previousMuted = audio.muted;
                    audio.muted = true;
                    const attempt = audio.play();
                    if (attempt && typeof attempt.then === 'function') {
                        attempt
                            .then(() => {
                                audio.pause();
                                audio.currentTime = 0;
                                audio.muted = previousMuted;
                            })
                            .catch(() => {
                                audio.muted = previousMuted;
                            });
                    } else {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.muted = previousMuted;
                    }
                });
            });
        }

        function toggleMute() {
            muted = !muted;
            writeMuted(muted);
            return muted;
        }

        function isMuted() {
            return muted;
        }

        return { init, play, unlock, toggleMute, isMuted };
    })();

    /* ----------------------------------------------------------------------
       Game
       ---------------------------------------------------------------------- */
    class SnakeGame {
        constructor() {
            this.canvas = $('gameCanvas');
            this.ctx = this.canvas.getContext('2d');

            this.dom = {
                score: $('scoreValue'),
                best: $('bestValue'),
                length: $('lengthValue'),
                startOverlay: $('startOverlay'),
                pauseOverlay: $('pauseOverlay'),
                overOverlay: $('gameOverOverlay'),
                startBtn: $('startBtn'),
                resumeBtn: $('resumeBtn'),
                restartBtn: $('restartBtn'),
                startBest: $('startBest'),
                finalScore: $('finalScore'),
                finalBest: $('finalBest'),
                finalLength: $('finalLength'),
                newRecord: $('newRecordBadge'),
                soundToggle: $('soundToggle'),
                soundLabel: $('soundLabel'),
                liveStatus: $('liveStatus'),
            };

            this.overlays = [
                this.dom.startOverlay,
                this.dom.pauseOverlay,
                this.dom.overOverlay,
            ];

            this.state = 'ready';
            this.snake = [];
            this.prevSnake = [];
            this.direction = { ...DIR.right };
            this.pendingDirections = [];
            this.food = null;
            this.foodBornAt = 0;
            this.score = 0;
            this.foodsEaten = 0;
            this.stepInterval = CONFIG.startStep;
            this.accumulator = 0;
            this.lastTime = 0;
            this.lastAlpha = 1;
            this.particles = [];
            this.dead = false;
            this.deathAt = 0;
            this.newRecord = false;
            this.best = this.readBest();
            this.overlayTimer = null;

            this.loop = this.loop.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);

            this.setupCanvas();
            this.resetRound();
            this.bindEvents();
            this.syncSoundButton(AudioFX.isMuted());
            this.setOverlay(this.dom.startOverlay, true);
            this.setOverlay(this.dom.pauseOverlay, false);
            this.setOverlay(this.dom.overOverlay, false);
            this.updateHud();

            requestAnimationFrame(this.loop);
        }

        /* ---------------------------- Setup ---------------------------- */

        setupCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = this.canvas.getBoundingClientRect();
            const cssWidth = rect.width || BOARD;
            const scale = (cssWidth / BOARD) * dpr;

            this.canvas.width = Math.max(1, Math.round(BOARD * scale));
            this.canvas.height = Math.max(1, Math.round(BOARD * scale));
            this.ctx.setTransform(scale, 0, 0, scale, 0, 0);

            this.scale = scale;
            this.dpr = dpr;
        }

        refreshCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const cssWidth = this.canvas.getBoundingClientRect().width || BOARD;
            const scale = (cssWidth / BOARD) * dpr;

            if (Math.abs(scale - (this.scale || 0)) < 0.01) return;

            this.setupCanvas();
            this.render(performance.now(), this.lastAlpha);
        }

        bindEvents() {
            this.dom.startBtn.addEventListener('click', () => {
                this.dom.startBtn.blur();
                this.start();
            });

            this.dom.restartBtn.addEventListener('click', () => {
                this.dom.restartBtn.blur();
                this.start();
            });

            this.dom.resumeBtn.addEventListener('click', () => {
                this.dom.resumeBtn.blur();
                this.resume();
            });

            this.dom.soundToggle.addEventListener('click', () => {
                const muted = AudioFX.toggleMute();
                this.syncSoundButton(muted);
                this.announce(muted ? 'Sound effects muted.' : 'Sound effects on.');
            });

            document.addEventListener('keydown', this.handleKeyDown);

            // Auto-pause when the tab or window loses focus.
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.pause(true);
            });
            window.addEventListener('blur', () => this.pause(true));

            // Keep the canvas backing store matched to its CSS size for crisp lines.
            let resizeFrame = 0;
            const scheduleRefresh = () => {
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(() => this.refreshCanvas());
            };

            window.addEventListener('resize', scheduleRefresh);
            if ('ResizeObserver' in window) {
                const observer = new ResizeObserver(scheduleRefresh);
                observer.observe(this.canvas);
            }

            this.bindSwipe();
        }

        bindSwipe() {
            let tracking = false;
            let startX = 0;
            let startY = 0;

            this.canvas.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse') return;
                tracking = true;
                startX = event.clientX;
                startY = event.clientY;
            });

            window.addEventListener('pointerup', (event) => {
                if (!tracking) return;
                tracking = false;

                const dx = event.clientX - startX;
                const dy = event.clientY - startY;
                if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
                if (this.state !== 'playing') return;

                let dir;
                if (Math.abs(dx) > Math.abs(dy)) {
                    dir = dx > 0 ? DIR.right : DIR.left;
                } else {
                    dir = dy > 0 ? DIR.down : DIR.up;
                }
                this.queueDirection(dir);
            });

            window.addEventListener('pointercancel', () => {
                tracking = false;
            });
        }

        /* --------------------------- Round flow --------------------------- */

        resetRound() {
            const startX = Math.floor(COLS / 2);
            const startY = Math.floor(ROWS / 2);

            this.snake = [];
            for (let i = 0; i < CONFIG.startLength; i += 1) {
                this.snake.push({ x: startX - i, y: startY });
            }

            this.prevSnake = this.snake.map((segment) => ({ ...segment }));
            this.direction = { ...DIR.right };
            this.pendingDirections = [];
            this.score = 0;
            this.foodsEaten = 0;
            this.stepInterval = CONFIG.startStep;
            this.accumulator = 0;
            this.lastAlpha = 1;
            this.particles = [];
            this.dead = false;
            this.deathAt = 0;
            this.newRecord = false;

            this.spawnFood();
            this.updateHud();
        }

        start() {
            if (this.state === 'playing' || this.state === 'paused') return;

            clearTimeout(this.overlayTimer);
            AudioFX.unlock();

            this.resetRound();
            this.state = 'playing';
            this.lastTime = performance.now();
            this.hideOverlays();

            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            this.announce('Game started. Steer with the arrow keys or W A S D.');
        }

        pause(auto = false) {
            if (this.state !== 'playing') return;

            this.state = 'paused';
            this.setOverlay(this.dom.pauseOverlay, true);
            this.announce('Game paused.');

            if (!auto) {
                this.dom.resumeBtn.focus({ preventScroll: true });
            }
        }

        resume() {
            if (this.state !== 'paused') return;

            this.state = 'playing';
            this.lastTime = performance.now();
            this.setOverlay(this.dom.pauseOverlay, false);
            this.announce('Resumed.');
        }

        togglePause() {
            if (this.state === 'playing') {
                this.pause();
            } else if (this.state === 'paused') {
                this.resume();
            }
        }

        endGame() {
            if (this.state !== 'playing') return;

            this.state = 'gameover';
            this.dead = true;
            this.deathAt = performance.now();

            AudioFX.play('lose');

            const previousBest = this.best;
            if (this.score > previousBest) {
                this.best = this.score;
                this.newRecord = true;
                this.saveBest();
                restartAnimation(this.dom.best, 'is-popping');
            }

            this.updateHud();
            this.announce(`Game over. Final score ${this.score}.`);

            clearTimeout(this.overlayTimer);
            this.overlayTimer = setTimeout(() => this.showGameOver(), CONFIG.deathDelay);
        }

        showGameOver() {
            this.dom.finalScore.textContent = String(this.score);
            this.dom.finalBest.textContent = String(this.best);
            this.dom.finalLength.textContent = String(this.snake.length);
            this.dom.newRecord.hidden = !this.newRecord;

            this.setOverlay(this.dom.overOverlay, true);
            this.dom.restartBtn.focus({ preventScroll: true });
        }

        /* ---------------------------- Mechanics ---------------------------- */

        queueDirection(next) {
            const last = this.pendingDirections.length > 0
                ? this.pendingDirections[this.pendingDirections.length - 1]
                : this.direction;

            // Ignore duplicates and 180° turns.
            if (next.x === last.x && next.y === last.y) return;
            if (next.x === -last.x && next.y === -last.y) return;
            if (this.pendingDirections.length >= 2) return;

            this.pendingDirections.push({ x: next.x, y: next.y });
        }

        step() {
            if (this.pendingDirections.length > 0) {
                this.direction = this.pendingDirections.shift();
            }

            const head = this.snake[0];
            const next = {
                x: head.x + this.direction.x,
                y: head.y + this.direction.y,
            };

            // Wall collision.
            if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
                this.endGame();
                return;
            }

            const eating = Boolean(
                this.food && next.x === this.food.x && next.y === this.food.y
            );

            // The tail vacates its cell this step unless the snake is growing,
            // so moving into it is legal.
            const bodyLimit = eating ? this.snake.length : this.snake.length - 1;
            for (let i = 0; i < bodyLimit; i += 1) {
                if (this.snake[i].x === next.x && this.snake[i].y === next.y) {
                    this.endGame();
                    return;
                }
            }

            this.prevSnake = this.snake.map((segment) => ({ ...segment }));
            this.snake.unshift(next);

            if (eating) {
                this.eat(next);
            } else {
                this.snake.pop();
            }
        }

        eat(cell) {
            this.score += CONFIG.scorePerFood;
            this.foodsEaten += 1;
            this.stepInterval = Math.max(
                CONFIG.minStep,
                CONFIG.startStep - this.foodsEaten * CONFIG.speedUpPerFood
            );

            this.spawnParticles(cell);
            this.spawnFood();
            this.updateHud();
            restartAnimation(this.dom.score, 'is-popping');
            AudioFX.play('eat');
        }

        spawnFood() {
            const occupied = new Set(
                this.snake.map((segment) => `${segment.x},${segment.y}`)
            );
            const free = [];

            for (let y = 0; y < ROWS; y += 1) {
                for (let x = 0; x < COLS; x += 1) {
                    if (!occupied.has(`${x},${y}`)) free.push({ x, y });
                }
            }

            if (free.length === 0) {
                this.food = null;
                return;
            }

            this.food = free[Math.floor(Math.random() * free.length)];
            this.foodBornAt = performance.now();
        }

        /* ----------------------------- Particles ----------------------------- */

        spawnParticles(cell) {
            const cx = (cell.x + 0.5) * CELL;
            const cy = (cell.y + 0.5) * CELL;

            for (let i = 0; i < 14; i += 1) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 40 + Math.random() * 130;

                this.particles.push({
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    size: 1.6 + Math.random() * 2.4,
                    color: Math.random() > 0.45 ? COLOR.food : '#ff8a3d',
                });
            }
        }

        updateParticles(dt) {
            const seconds = dt / 1000;

            for (let i = this.particles.length - 1; i >= 0; i -= 1) {
                const particle = this.particles[i];
                particle.x += particle.vx * seconds;
                particle.y += particle.vy * seconds;
                particle.vx *= 0.94;
                particle.vy *= 0.94;
                particle.life -= seconds * 1.7;

                if (particle.life <= 0) this.particles.splice(i, 1);
            }
        }

        /* ------------------------------ Loop ------------------------------ */

        loop(now) {
            const dt = Math.min(now - (this.lastTime || now), 120);
            this.lastTime = now;

            if (this.state === 'playing') {
                this.accumulator += dt;

                let steps = 0;
                while (this.accumulator >= this.stepInterval && steps < 4) {
                    this.accumulator -= this.stepInterval;
                    this.step();
                    steps += 1;
                    if (this.state !== 'playing') break;
                }

                this.updateParticles(dt);
                this.lastAlpha = Math.min(this.accumulator / this.stepInterval, 1);
            } else if (this.dead) {
                this.updateParticles(dt);
            }

            const alpha = this.lastAlpha;
            this.render(now, alpha);
            requestAnimationFrame(this.loop);
        }

        /* ----------------------------- Rendering ----------------------------- */

        render(time, alpha) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, BOARD, BOARD);

            this.drawBoard();
            if (this.food) this.drawFood(time);
            this.drawSnake(alpha);
            this.drawParticles();
            if (this.dead) this.drawDeathFlash(time);
        }

        drawBoard() {
            const ctx = this.ctx;

            ctx.fillStyle = '#060a13';
            ctx.fillRect(0, 0, BOARD, BOARD);

            // Checkerboard tint.
            ctx.fillStyle = COLOR.gridAccent;
            for (let y = 0; y < ROWS; y += 1) {
                for (let x = 0; x < COLS; x += 1) {
                    if ((x + y) % 2 === 0) {
                        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
                    }
                }
            }

            // Grid lines.
            ctx.strokeStyle = COLOR.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 1; x < COLS; x += 1) {
                ctx.moveTo(x * CELL + 0.5, 0);
                ctx.lineTo(x * CELL + 0.5, BOARD);
            }
            for (let y = 1; y < ROWS; y += 1) {
                ctx.moveTo(0, y * CELL + 0.5);
                ctx.lineTo(BOARD, y * CELL + 0.5);
            }
            ctx.stroke();

            // Inner frame.
            ctx.strokeStyle = COLOR.frame;
            ctx.strokeRect(0.5, 0.5, BOARD - 1, BOARD - 1);
        }

        drawFood(time) {
            const ctx = this.ctx;
            const cx = (this.food.x + 0.5) * CELL;
            const cy = (this.food.y + 0.5) * CELL;

            const spawnProgress = Math.min((time - this.foodBornAt) / 220, 1);
            const spawnScale = REDUCED_MOTION ? 1 : easeOutBack(spawnProgress);
            const pulse = REDUCED_MOTION ? 1 : 1 + Math.sin(time / 190) * 0.07;
            const rotation = REDUCED_MOTION ? 0 : time / 900;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.scale(spawnScale * pulse, spawnScale * pulse);

            ctx.shadowColor = 'rgba(255, 200, 87, 0.9)';
            ctx.shadowBlur = 18;
            ctx.fillStyle = COLOR.food;
            roundRect(ctx, -CELL * 0.22, -CELL * 0.22, CELL * 0.44, CELL * 0.44, 5);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = COLOR.foodCore;
            roundRect(ctx, -CELL * 0.08, -CELL * 0.08, CELL * 0.16, CELL * 0.16, 2);
            ctx.fill();

            ctx.restore();
        }

        drawSnake(alpha) {
            const ctx = this.ctx;
            const length = this.snake.length;
            const prev = this.prevSnake;

            // Draw tail → head so the head sits on top.
            for (let i = length - 1; i >= 0; i -= 1) {
                const current = this.snake[i];
                const from = prev.length > 0
                    ? prev[Math.min(i, prev.length - 1)]
                    : current;

                const x = (from.x + (current.x - from.x) * alpha) * CELL;
                const y = (from.y + (current.y - from.y) * alpha) * CELL;
                const t = length > 1 ? i / (length - 1) : 0;

                const padding = 2.2;
                const size = CELL - padding * 2;
                const radius = i === 0 ? 7 : 5;

                if (this.dead) {
                    ctx.fillStyle = `hsl(344, 95%, ${64 - t * 24}%)`;
                } else {
                    ctx.fillStyle = `hsl(152, 100%, ${72 - t * 32}%)`;
                }

                if (i === 0) {
                    ctx.save();
                    ctx.shadowColor = this.dead
                        ? 'rgba(255, 61, 154, 0.85)'
                        : 'rgba(77, 255, 158, 0.8)';
                    ctx.shadowBlur = 16;
                    roundRect(ctx, x + padding, y + padding, size, size, radius);
                    ctx.fill();
                    ctx.restore();
                } else {
                    roundRect(ctx, x + padding, y + padding, size, size, radius);
                    ctx.fill();
                }
            }

            this.drawEyes(alpha);
        }

        drawEyes(alpha) {
            const ctx = this.ctx;
            const head = this.snake[0];
            if (!head) return;

            const prev = this.prevSnake.length > 0 ? this.prevSnake[0] : head;
            const x = (prev.x + (head.x - prev.x) * alpha) * CELL;
            const y = (prev.y + (head.y - prev.y) * alpha) * CELL;
            const cx = x + CELL / 2;
            const cy = y + CELL / 2;

            const dir = this.direction;
            const perpX = -dir.y;
            const perpY = dir.x;
            const forward = CELL * 0.14;
            const side = CELL * 0.17;

            for (const sign of [-1, 1]) {
                const ex = cx + dir.x * forward + perpX * side * sign;
                const ey = cy + dir.y * forward + perpY * side * sign;

                ctx.fillStyle = this.dead ? '#2a0614' : '#04120b';
                ctx.beginPath();
                ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(ex + dir.x * 0.8 - 0.5, ey + dir.y * 0.8 - 0.5, 0.9, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawParticles() {
            const ctx = this.ctx;

            for (const particle of this.particles) {
                ctx.globalAlpha = Math.max(particle.life, 0);
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;
        }

        drawDeathFlash(time) {
            const ctx = this.ctx;
            const elapsed = time - this.deathAt;
            const strength = Math.max(0, 1 - elapsed / 620);

            if (strength <= 0) return;

            ctx.fillStyle = `rgba(${COLOR.danger}, ${0.22 * strength})`;
            ctx.fillRect(0, 0, BOARD, BOARD);

            ctx.strokeStyle = `rgba(${COLOR.danger}, ${0.85 * strength})`;
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, BOARD - 6, BOARD - 6);
        }

        /* ------------------------------- Input ------------------------------- */

        handleKeyDown(event) {
            const key = event.key;
            const lower = key.toLowerCase();

            // Let focused buttons handle their own Space / Enter activation.
            if (
                event.target instanceof Element &&
                event.target.closest('button') &&
                (key === ' ' || key === 'Enter')
            ) {
                return;
            }

            const directionName = KEY_DIRECTIONS[lower];
            if (directionName) {
                event.preventDefault();
                if (this.state === 'playing') {
                    this.queueDirection(DIR[directionName]);
                }
                return;
            }

            if (key === ' ' || key === 'Spacebar') {
                event.preventDefault();
                if (this.state === 'ready' || this.state === 'gameover') {
                    this.start();
                } else if (this.state === 'paused') {
                    this.resume();
                }
                return;
            }

            if (lower === 'p') {
                event.preventDefault();
                this.togglePause();
                return;
            }

            if (lower === 'm') {
                const muted = AudioFX.toggleMute();
                this.syncSoundButton(muted);
                this.announce(muted ? 'Sound effects muted.' : 'Sound effects on.');
            }
        }

        /* -------------------------------- HUD -------------------------------- */

        updateHud() {
            this.dom.score.textContent = String(this.score);
            this.dom.best.textContent = String(this.best);
            this.dom.length.textContent = String(this.snake.length);
            this.dom.startBest.textContent = String(this.best);
        }

        setOverlay(overlay, active) {
            overlay.classList.toggle('is-active', active);
            overlay.setAttribute('aria-hidden', String(!active));

            if ('inert' in overlay) {
                overlay.inert = !active;
            }
        }

        hideOverlays() {
            this.overlays.forEach((overlay) => this.setOverlay(overlay, false));
        }

        syncSoundButton(muted) {
            this.dom.soundToggle.classList.toggle('is-muted', muted);
            this.dom.soundToggle.setAttribute('aria-pressed', String(muted));
            this.dom.soundToggle.setAttribute(
                'aria-label',
                muted ? 'Unmute sound effects' : 'Mute sound effects'
            );
            this.dom.soundLabel.textContent = muted ? 'OFF' : 'SFX';
        }

        announce(message) {
            this.dom.liveStatus.textContent = '';
            // Let assistive tech register the change before writing the new text.
            window.setTimeout(() => {
                this.dom.liveStatus.textContent = message;
            }, 60);
        }

        /* ---------------------------- Persistence ---------------------------- */

        readBest() {
            try {
                const raw = localStorage.getItem(STORAGE.highScore);
                const value = Number.parseInt(raw, 10);
                return Number.isFinite(value) && value > 0 ? value : 0;
            } catch (error) {
                return 0;
            }
        }

        saveBest() {
            try {
                localStorage.setItem(STORAGE.highScore, String(this.best));
            } catch (error) {
                /* Ignore quota / privacy-mode failures. */
            }
        }
    }

    /* ----------------------------------------------------------------------
       Boot
       ---------------------------------------------------------------------- */
    AudioFX.init();

    const boot = () => {
        const canvas = $('gameCanvas');
        if (!canvas || !canvas.getContext) return;
        new SnakeGame();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
