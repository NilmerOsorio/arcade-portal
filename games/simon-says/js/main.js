/* ==========================================================================
   SIMON SAYS — Neon Memory Arcade
   Project 09 · Vanilla JavaScript game engine

   Responsibilities:
   - Four-pad state machine: idle / watching / player / gameover
   - Random sequence generation with async, cancellable playback
   - Real-time step validation, scoring and game-over flow
   - Web Audio synthesis: unique pad tones, error buzz, success arpeggio
   - Persistent high score and sound preference via localStorage
   - Keyboard, pointer and screen-reader friendly interactions
   ========================================================================== */

(() => {
    'use strict';

    /* ----------------------------------------------------------------------
       Configuration
       ---------------------------------------------------------------------- */
    const PADS = {
        green:  { label: 'Green',  frequency: 329.63, glyph: '\u25B2' }, // E4
        red:    { label: 'Red',    frequency: 261.63, glyph: '\u25C6' }, // C4
        yellow: { label: 'Yellow', frequency: 392.00, glyph: '\u25A0' }, // G4
        blue:   { label: 'Blue',   frequency: 196.00, glyph: '\u25CF' }, // G3
    };

    const COLOR_ORDER = ['green', 'red', 'yellow', 'blue'];

    const KEY_MAP = {
        g: 'green', '1': 'green',
        r: 'red', '2': 'red',
        y: 'yellow', '3': 'yellow',
        b: 'blue', '4': 'blue',
    };

    const TIMING = {
        startDelay: 520,
        leadIn: 620,
        padOn: 430,
        padGap: 170,
        pressFlash: 200,
        roundClear: 1150,
        gameOverReveal: 760,
    };

    const STORAGE = {
        best: 'simon.highScore.v1',
        muted: 'simon.muted.v1',
    };

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ----------------------------------------------------------------------
       Tiny DOM helpers
       ---------------------------------------------------------------------- */
    const $ = (id) => document.getElementById(id);

    const board = $('board');
    const padEls = Object.fromEntries(
        COLOR_ORDER.map((color) => [color, document.querySelector(`[data-color="${color}"]`)])
    );

    const scoreValue = $('scoreValue');
    const bestValue = $('bestValue');
    const roundValue = $('roundValue');
    const startBest = $('startBest');

    const phaseText = $('phaseText');
    const playOverlay = $('playOverlay');
    const statusText = $('statusText');
    const statusCount = $('statusCount');
    const progressDots = $('progressDots');
    const liveStatus = $('liveStatus');

    const startOverlay = $('startOverlay');
    const gameOverOverlay = $('gameOverOverlay');
    const startBtn = $('startBtn');
    const restartBtn = $('restartBtn');

    const finalScore = $('finalScore');
    const finalBest = $('finalBest');
    const finalRound = $('finalRound');
    const gameOverReason = $('gameOverReason');
    const newRecordBadge = $('newRecordBadge');

    const soundBtn = $('soundToggle');
    const soundLabel = $('soundLabel');

    const litTimers = {};
    const pressTimers = {};
    let overlayTimer = 0;
    let nudgeTimer = 0;

    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    function restartAnimation(el, className) {
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
    }

    function announce(message) {
        liveStatus.textContent = message;
    }

    /* ----------------------------------------------------------------------
       Persistence
       ---------------------------------------------------------------------- */
    function readBest() {
        try {
            const value = Number.parseInt(window.localStorage.getItem(STORAGE.best), 10);
            return Number.isFinite(value) && value > 0 ? value : 0;
        } catch {
            return 0;
        }
    }

    function writeBest(value) {
        try {
            window.localStorage.setItem(STORAGE.best, String(value));
        } catch {
            /* Storage unavailable — keep the in-memory best. */
        }
    }

    function readMuted() {
        try {
            return window.localStorage.getItem(STORAGE.muted) === 'true';
        } catch {
            return false;
        }
    }

    function writeMuted(value) {
        try {
            window.localStorage.setItem(STORAGE.muted, String(value));
        } catch {
            /* Storage unavailable — ignore. */
        }
    }

    /* ----------------------------------------------------------------------
       Game state
       ---------------------------------------------------------------------- */
    const game = {
        state: 'idle',
        sequence: [],
        round: 0,
        score: 0,
        playerIndex: 0,
        best: readBest(),
        bestAtStart: 0,
        muted: readMuted(),
        session: 0,
    };

    /* ----------------------------------------------------------------------
       Web Audio synthesis
       ---------------------------------------------------------------------- */
    let audioCtx = null;
    let masterGain = null;

    function getAudio() {
        if (game.muted) return null;

        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;
            try {
                audioCtx = new AudioContextClass();
            } catch {
                return null;
            }
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        if (!masterGain) {
            masterGain = audioCtx.createGain();
            masterGain.gain.value = game.muted ? 0 : 0.9;
            masterGain.connect(audioCtx.destination);
        }

        return audioCtx;
    }

    function scheduleTone(ctx, frequency, start, duration, gain, type) {
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, start);
        out.gain.exponentialRampToValueAtTime(gain, start + 0.014);
        out.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(4200, frequency * 6), start);
        filter.Q.value = 0.7;
        out.connect(filter);
        filter.connect(masterGain);

        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);

        const accent = ctx.createOscillator();
        accent.type = 'sine';
        accent.frequency.setValueAtTime(frequency * 2, start);
        const accentGain = ctx.createGain();
        accentGain.gain.value = 0.14;

        osc.connect(out);
        accent.connect(accentGain);
        accentGain.connect(out);

        osc.start(start);
        osc.stop(start + duration + 0.04);
        accent.start(start);
        accent.stop(start + duration + 0.04);
    }

    function playTone(frequency, { duration = 0.36, gain = 0.14, type = 'triangle', when = 0 } = {}) {
        const ctx = getAudio();
        if (!ctx) return;
        scheduleTone(ctx, frequency, ctx.currentTime + when, duration, gain, type);
    }

    function playPadTone(color, duration) {
        playTone(PADS[color].frequency, { duration, gain: 0.15 });
    }

    function playSuccess() {
        const ctx = getAudio();
        if (!ctx) return;
        const start = ctx.currentTime + 0.02;
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
            scheduleTone(ctx, frequency, start + index * 0.085, 0.24, 0.09, 'triangle');
        });
    }

    function playError() {
        const ctx = getAudio();
        if (!ctx) return;

        const start = ctx.currentTime + 0.02;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, start);
        out.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        out.gain.setValueAtTime(0.16, start + 0.18);
        out.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, start);
        filter.frequency.exponentialRampToValueAtTime(240, start + 0.7);
        out.connect(filter);
        filter.connect(masterGain);

        [0, -9].forEach((detune) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.detune.value = detune;
            osc.frequency.setValueAtTime(232, start);
            osc.frequency.exponentialRampToValueAtTime(68, start + 0.65);
            osc.connect(out);
            osc.start(start);
            osc.stop(start + 0.78);
        });
    }

    function syncSoundUI() {
        soundBtn.classList.toggle('is-muted', game.muted);
        soundBtn.setAttribute('aria-pressed', String(game.muted));
        soundBtn.setAttribute('aria-label', game.muted ? 'Unmute sound effects' : 'Mute sound effects');
        soundLabel.textContent = game.muted ? 'OFF' : 'SFX';
    }

    function setMuted(muted) {
        game.muted = muted;
        if (audioCtx && masterGain) {
            masterGain.gain.setTargetAtTime(muted ? 0 : 0.9, audioCtx.currentTime, 0.015);
        }
        syncSoundUI();
        writeMuted(muted);

        if (!muted) {
            getAudio();
            playTone(523.25, { duration: 0.16, gain: 0.1, type: 'sine' });
        }
    }

    /* ----------------------------------------------------------------------
       UI rendering
       ---------------------------------------------------------------------- */
    function setPhase(phase, label, message) {
        playOverlay.dataset.phase = phase;
        phaseText.textContent = label;
        if (typeof message === 'string') {
            statusText.textContent = message;
        }
    }

    function updateHud(popBest = false) {
        scoreValue.textContent = String(game.score);
        bestValue.textContent = String(game.best);
        roundValue.textContent = game.round > 0 ? String(game.round) : '\u2014';
        startBest.textContent = String(game.best);
        if (popBest) restartAnimation(bestValue, 'is-popping');
    }

    function renderProgress(done, total) {
        progressDots.replaceChildren();
        for (let index = 0; index < total; index += 1) {
            const pip = document.createElement('li');
            pip.className = index < done ? 'pip is-done' : 'pip';
            progressDots.appendChild(pip);
        }
        statusCount.textContent = total > 0 ? `${done} / ${total}` : '\u2014';
    }

    function openOverlay(overlay, focusTarget) {
        overlay.classList.add('is-active');
        overlay.setAttribute('aria-hidden', 'false');
        if (!focusTarget) return;
        window.setTimeout(() => {
            if (!overlay.classList.contains('is-active')) return;
            focusTarget.focus({ preventScroll: true });
        }, REDUCED_MOTION ? 0 : 280);
    }

    function closeOverlay(overlay) {
        overlay.classList.remove('is-active');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function setState(next) {
        game.state = next;
        board.dataset.state = next;
        const unlocked = next === 'player';
        board.classList.toggle('is-locked', !unlocked);
        COLOR_ORDER.forEach((color) => {
            padEls[color].tabIndex = unlocked ? 0 : -1;
        });
        if (!unlocked && board.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }

    function nudgeBoard() {
        board.classList.remove('is-nudged');
        void board.offsetWidth;
        board.classList.add('is-nudged');
        window.clearTimeout(nudgeTimer);
        nudgeTimer = window.setTimeout(() => board.classList.remove('is-nudged'), 340);
    }

    function resetPadVisuals() {
        COLOR_ORDER.forEach((color) => {
            window.clearTimeout(litTimers[color]);
            window.clearTimeout(pressTimers[color]);
            padEls[color].classList.remove('is-lit', 'is-pressed');
        });
    }

    function flashPad(color, duration, isUser = false) {
        const pad = padEls[color];
        const className = isUser ? 'is-pressed' : 'is-lit';
        const timers = isUser ? pressTimers : litTimers;

        pad.classList.add(className);
        playPadTone(color, isUser ? 0.3 : 0.38);

        window.clearTimeout(timers[color]);
        timers[color] = window.setTimeout(() => pad.classList.remove(className), duration);
    }

    /* ----------------------------------------------------------------------
       Sequence generation & playback
       ---------------------------------------------------------------------- */
    function pickColor() {
        const { sequence } = game;
        const last = sequence[sequence.length - 1];
        const beforeLast = sequence[sequence.length - 2];
        let color;

        do {
            color = COLOR_ORDER[Math.floor(Math.random() * COLOR_ORDER.length)];
        } while (sequence.length >= 2 && color === last && last === beforeLast);

        return color;
    }

    async function nextRound(token) {
        if (token !== game.session) return;

        game.round += 1;
        game.playerIndex = 0;
        game.sequence.push(pickColor());

        setState('watching');
        updateHud();
        renderProgress(0, game.sequence.length);
        setPhase('watch', 'WATCH', 'Watch closely \u2014 the pattern is playing.');
        statusCount.textContent = game.sequence.length === 1 ? '1 step' : `${game.sequence.length} steps`;
        announce(`Round ${game.round}. Watch ${game.sequence.length} ${game.sequence.length === 1 ? 'step' : 'steps'}.`);

        await sleep(TIMING.leadIn);
        if (token !== game.session) return;

        for (const color of game.sequence) {
            if (token !== game.session) return;
            flashPad(color, TIMING.padOn, false);
            await sleep(TIMING.padOn + TIMING.padGap);
        }

        if (token !== game.session) return;
        beginPlayerTurn();
    }

    function beginPlayerTurn() {
        setState('player');
        renderProgress(0, game.sequence.length);
        setPhase(
            'turn',
            'YOUR TURN',
            `Your turn \u2014 repeat ${game.sequence.length} ${game.sequence.length === 1 ? 'step' : 'steps'} in order.`
        );
        announce(`Your turn. Repeat the ${game.sequence.length}-step pattern.`);
    }

    /* ----------------------------------------------------------------------
       Validation, scoring & game over
       ---------------------------------------------------------------------- */
    function startGame() {
        getAudio();

        if (document.activeElement && (startOverlay.contains(document.activeElement) ||
            gameOverOverlay.contains(document.activeElement))) {
            document.activeElement.blur();
        }

        game.session += 1;
        const token = game.session;

        window.clearTimeout(overlayTimer);
        window.clearTimeout(nudgeTimer);
        resetPadVisuals();
        board.classList.remove('is-shaking', 'is-nudged');

        closeOverlay(startOverlay);
        closeOverlay(gameOverOverlay);
        newRecordBadge.hidden = true;

        game.sequence = [];
        game.round = 0;
        game.score = 0;
        game.playerIndex = 0;
        game.bestAtStart = game.best;

        setState('watching');
        updateHud();
        renderProgress(0, 0);
        setPhase('watch', 'READY', 'Powering up the grid\u2026');
        announce('New game. Get ready.');

        (async () => {
            await sleep(TIMING.startDelay);
            if (token !== game.session) return;
            void nextRound(token);
        })();
    }

    function completeRound() {
        setState('watching');
        game.score = game.round;

        const isRecord = game.score > game.best;
        if (isRecord) {
            game.best = game.score;
            writeBest(game.best);
        }

        updateHud(isRecord);
        restartAnimation(scoreValue, 'is-popping');
        renderProgress(game.sequence.length, game.sequence.length);
        setPhase('clear', 'NICE!', `Round ${game.round} cleared. Next pattern incoming\u2026`);
        playSuccess();
        announce(`Round ${game.round} complete. Score ${game.score}.`);

        const token = game.session;
        (async () => {
            await sleep(TIMING.roundClear);
            if (token !== game.session) return;
            void nextRound(token);
        })();
    }

    function evaluate(color) {
        const expected = game.sequence[game.playerIndex];
        if (!expected) return;

        if (color !== expected) {
            endGame(expected, color);
            return;
        }

        game.playerIndex += 1;
        renderProgress(game.playerIndex, game.sequence.length);

        if (game.playerIndex === game.sequence.length) {
            completeRound();
            return;
        }

        statusText.textContent = `Step ${game.playerIndex} correct \u2014 keep the chain going.`;
        announce(`Correct. ${game.playerIndex} of ${game.sequence.length}.`);
    }

    function endGame(expected, actual) {
        game.session += 1;
        setState('gameover');
        renderProgress(game.playerIndex, game.sequence.length);
        setPhase('miss', 'MISS', 'Sequence broken \u2014 the run is over.');

        board.classList.remove('is-shaking');
        void board.offsetWidth;
        board.classList.add('is-shaking');
        playError();
        announce(`Game over. You pressed ${PADS[actual].label}. ${PADS[expected].label} was next.`);

        window.clearTimeout(overlayTimer);
        overlayTimer = window.setTimeout(() => {
            if (game.state !== 'gameover') return;

            finalScore.textContent = String(game.score);
            finalBest.textContent = String(game.best);
            finalRound.textContent = String(game.round);
            gameOverReason.textContent = `You pressed ${PADS[actual].label} where ${PADS[expected].label} was next.`;
            newRecordBadge.hidden = !(game.score > game.bestAtStart && game.score > 0);
            openOverlay(gameOverOverlay, restartBtn);
        }, TIMING.gameOverReveal);
    }

    function handlePadPress(color) {
        getAudio();

        if (game.state === 'watching') {
            nudgeBoard();
            announce('Wait for the computer to finish playing.');
            return;
        }

        if (game.state !== 'player') return;

        flashPad(color, TIMING.pressFlash, true);
        evaluate(color);
    }

    /* ----------------------------------------------------------------------
       Events
       ---------------------------------------------------------------------- */
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    soundBtn.addEventListener('click', () => setMuted(!game.muted));

    COLOR_ORDER.forEach((color) => {
        const pad = padEls[color];

        pad.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            handlePadPress(color);
        });

        // Keyboard and assistive-technology activation (detail === 0).
        pad.addEventListener('click', (event) => {
            if (event.detail === 0) handlePadPress(color);
        });
    });

    board.addEventListener('animationend', (event) => {
        if (event.target !== board) return;
        board.classList.remove('is-shaking', 'is-nudged');
    });

    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || event.repeat) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const key = event.key.toLowerCase();

        if (key === 'm') {
            event.preventDefault();
            setMuted(!game.muted);
            return;
        }

        if (KEY_MAP[key]) {
            if (game.state === 'player') {
                event.preventDefault();
                handlePadPress(KEY_MAP[key]);
            }
            return;
        }

        if (key === ' ' || key === 'enter') {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag === 'BUTTON' || activeTag === 'A') return;
            if (game.state === 'idle' || game.state === 'gameover') {
                event.preventDefault();
                startGame();
            }
        }
    });

    /* ----------------------------------------------------------------------
       Initialise
       ---------------------------------------------------------------------- */
    function init() {
        syncSoundUI();
        setState('idle');
        updateHud();
        renderProgress(0, 0);
        setPhase('idle', 'READY', 'Press Start to power up the grid.');
        closeOverlay(gameOverOverlay);
        announce('Welcome to Simon Says. Press Start to play.');
    }

    init();
})();
