/* ==========================================================================
   Memory Match — Project 12
   Card deck, Fisher-Yates shuffle, flip state machine, timer & local records
   ========================================================================== */

(() => {
    'use strict';

    /* ----------------------------------------------------------------------
       Constants & configuration
       ---------------------------------------------------------------------- */
    const DIFFICULTIES = Object.freeze({
        easy: Object.freeze({ key: 'easy', label: 'Easy', columns: 4, rows: 3, pairs: 6 }),
        medium: Object.freeze({ key: 'medium', label: 'Medium', columns: 4, rows: 4, pairs: 8 }),
        hard: Object.freeze({ key: 'hard', label: 'Hard', columns: 6, rows: 4, pairs: 12 }),
    });

    const SYMBOLS = Object.freeze([
        { icon: '🦊', name: 'Fox' },
        { icon: '🌙', name: 'Moon' },
        { icon: '🔥', name: 'Flame' },
        { icon: '🌵', name: 'Cactus' },
        { icon: '🍄', name: 'Mushroom' },
        { icon: '⚡', name: 'Lightning bolt' },
        { icon: '🚀', name: 'Rocket' },
        { icon: '🍉', name: 'Watermelon' },
        { icon: '🐙', name: 'Octopus' },
        { icon: '💎', name: 'Gem' },
        { icon: '🧩', name: 'Puzzle piece' },
        { icon: '👻', name: 'Ghost' },
    ]);

    const STORAGE_KEY = 'memorycard.bests.v1';
    const FLIP_BACK_DELAY = 800; // Spec: mismatches stay visible for 0.8 s.
    const MATCH_LOCK_DELAY = 620; // Let the 3D flip finish before the next turn.
    const WIN_MODAL_DELAY = 720;
    const CLOCK_TICK = 250;

    /* ----------------------------------------------------------------------
       DOM references
       ---------------------------------------------------------------------- */
    const game = document.getElementById('game');
    const app = document.querySelector('.app');
    const board = document.getElementById('board');

    const movesValue = document.getElementById('movesValue');
    const matchesValue = document.getElementById('matchesValue');
    const pairsTotal = document.getElementById('pairsTotal');
    const timeValue = document.getElementById('timeValue');

    const resetButton = document.getElementById('resetButton');
    const recordDifficulty = document.getElementById('recordDifficulty');
    const bestMovesValue = document.getElementById('bestMovesValue');
    const bestTimeValue = document.getElementById('bestTimeValue');
    const statusMessage = document.getElementById('statusMessage');

    const difficultyButtons = Array.from(document.querySelectorAll('.difficulty__option'));

    const winOverlay = document.getElementById('winOverlay');
    const winEyebrow = document.getElementById('winEyebrow');
    const winMoves = document.getElementById('winMoves');
    const winTime = document.getElementById('winTime');
    const winBestMoves = document.getElementById('winBestMoves');
    const winBestTime = document.getElementById('winBestTime');
    const newMovesBadge = document.getElementById('newMovesBadge');
    const newTimeBadge = document.getElementById('newTimeBadge');
    const winNote = document.getElementById('winNote');
    const playAgainButton = document.getElementById('playAgainButton');
    const changeDifficultyButton = document.getElementById('changeDifficultyButton');

    const announcer = document.getElementById('announcer');

    /* ----------------------------------------------------------------------
       State
       ---------------------------------------------------------------------- */
    const state = {
        difficulty: 'easy',
        cards: [],
        firstCard: null,
        secondCard: null,
        locked: false,
        status: 'ready', // ready | playing | won
        moves: 0,
        matchedPairs: 0,
        startedAt: null,
        elapsedSeconds: 0,
        timerId: null,
        bests: readBests(),
        lastFocused: null,
        session: 0,
    };

    const pendingTimeouts = new Set();

    /* ----------------------------------------------------------------------
       Small helpers
       ---------------------------------------------------------------------- */
    function getConfig() {
        return DIFFICULTIES[state.difficulty];
    }

    function formatTime(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function describeTime(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        const parts = [];

        if (minutes > 0) {
            parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
        }

        parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
        return parts.join(' ');
    }

    function pairLabel(count) {
        return `${count} ${count === 1 ? 'pair' : 'pairs'}`;
    }

    function later(callback, delay) {
        const id = window.setTimeout(() => {
            pendingTimeouts.delete(id);
            callback();
        }, delay);

        pendingTimeouts.add(id);
        return id;
    }

    function clearPendingTimeouts() {
        pendingTimeouts.forEach((id) => window.clearTimeout(id));
        pendingTimeouts.clear();
    }

    function announce(message) {
        if (!message) {
            return;
        }

        announcer.textContent = '';
        window.requestAnimationFrame(() => {
            announcer.textContent = message;
        });
    }

    function setStatus(message) {
        statusMessage.textContent = message;
    }

    function bumpValue(element) {
        element.classList.remove('is-bumping');
        void element.offsetWidth;
        element.classList.add('is-bumping');
    }

    /* ----------------------------------------------------------------------
       Persistence — personal bests per difficulty
       ---------------------------------------------------------------------- */
    function createEmptyBests() {
        return {
            easy: { moves: null, time: null },
            medium: { moves: null, time: null },
            hard: { moves: null, time: null },
        };
    }

    function readBests() {
        const bests = createEmptyBests();

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return bests;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return bests;
            }

            Object.keys(bests).forEach((key) => {
                const entry = parsed[key];
                if (!entry || typeof entry !== 'object') {
                    return;
                }

                const moves = Number(entry.moves);
                const time = Number(entry.time);

                if (Number.isFinite(moves) && moves > 0) {
                    bests[key].moves = Math.floor(moves);
                }

                if (Number.isFinite(time) && time > 0) {
                    bests[key].time = Math.floor(time);
                }
            });
        } catch (error) {
            /* Private mode or blocked storage: keep working with in-memory bests. */
        }

        return bests;
    }

    function writeBests() {
        try {
            const payload = { version: 1 };

            Object.keys(state.bests).forEach((key) => {
                payload[key] = {
                    moves: state.bests[key].moves,
                    time: state.bests[key].time,
                };
            });

            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            /* The current session keeps its bests even if persistence is blocked. */
        }
    }

    function updateRecords() {
        const best = state.bests[state.difficulty];

        recordDifficulty.textContent = getConfig().label;
        bestMovesValue.textContent = best.moves === null ? '—' : String(best.moves);
        bestTimeValue.textContent = best.time === null ? '—' : formatTime(best.time);
        bestMovesValue.classList.toggle('is-empty', best.moves === null);
        bestTimeValue.classList.toggle('is-empty', best.time === null);
    }

    function commitRun(seconds) {
        const best = state.bests[state.difficulty];
        const newMoves = best.moves === null || state.moves < best.moves;
        const newTime = best.time === null || seconds < best.time;

        if (newMoves) {
            best.moves = state.moves;
        }

        if (newTime) {
            best.time = seconds;
        }

        if (newMoves || newTime) {
            writeBests();
        }

        updateRecords();

        if (newMoves) {
            bumpValue(bestMovesValue);
        }

        if (newTime) {
            bumpValue(bestTimeValue);
        }

        return {
            newMoves,
            newTime,
            bestMoves: best.moves,
            bestTime: best.time,
        };
    }

    /* ----------------------------------------------------------------------
       Deck creation & Fisher-Yates shuffle
       ---------------------------------------------------------------------- */
    function shuffle(items) {
        for (let index = items.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        }

        return items;
    }

    function createDeck(config) {
        const chosenSymbols = SYMBOLS.slice(0, config.pairs);
        const deck = [];

        chosenSymbols.forEach((symbol, pairId) => {
            // Golden-angle spacing keeps neighbouring pairs visually distinct.
            const hue = Math.round((pairId * 137.508 + 208) % 360);

            for (let copy = 0; copy < 2; copy += 1) {
                deck.push({
                    pairId,
                    symbol,
                    hue,
                    row: 0,
                    column: 0,
                    flipped: false,
                    matched: false,
                    element: null,
                });
            }
        });

        return shuffle(deck);
    }

    /* ----------------------------------------------------------------------
       Rendering
       ---------------------------------------------------------------------- */
    function createCardElement(card, index, config) {
        card.row = Math.floor(index / config.columns) + 1;
        card.column = (index % config.columns) + 1;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card';
        button.dataset.index = String(index);
        button.style.setProperty('--hue', String(card.hue));
        button.style.setProperty('--i', String(index));

        const inner = document.createElement('span');
        inner.className = 'card__inner';
        inner.setAttribute('aria-hidden', 'true');

        const back = document.createElement('span');
        back.className = 'card__face card__face--back';

        const pattern = document.createElement('span');
        pattern.className = 'card__pattern';
        back.append(pattern);

        const front = document.createElement('span');
        front.className = 'card__face card__face--front';

        const emoji = document.createElement('span');
        emoji.className = 'card__emoji';
        emoji.textContent = card.symbol.icon;
        front.append(emoji);

        inner.append(back, front);
        button.append(inner);

        card.element = button;
        updateCardLabel(card);

        return button;
    }

    function renderBoard(config) {
        board.style.setProperty('--cols', String(config.columns));
        board.style.setProperty('--rows', String(config.rows));
        board.setAttribute(
            'aria-label',
            `Memory board, ${config.label}: ${config.columns} columns by ${config.rows} rows, ${pairLabel(config.pairs)}.`,
        );

        const fragment = document.createDocumentFragment();

        state.cards.forEach((card, index) => {
            fragment.append(createCardElement(card, index, config));
        });

        board.replaceChildren(fragment);
    }

    function updateCardLabel(card) {
        if (!card.element) {
            return;
        }

        let label;

        if (card.matched) {
            label = `${card.symbol.name}, matched`;
        } else if (card.flipped) {
            label = `${card.symbol.name}, face up`;
        } else {
            label = `Hidden card, row ${card.row}, column ${card.column}`;
        }

        card.element.setAttribute('aria-label', label);
        card.element.setAttribute('aria-pressed', String(card.flipped || card.matched));
    }

    function updateHud() {
        const config = getConfig();

        movesValue.textContent = String(state.moves);
        matchesValue.textContent = String(state.matchedPairs);
        pairsTotal.textContent = `/ ${config.pairs}`;
        timeValue.textContent = formatTime(state.elapsedSeconds);
    }

    function setBoardLocked(locked) {
        state.locked = locked;
        board.classList.toggle('is-locked', locked);

        state.cards.forEach((card) => {
            if (!card.element) {
                return;
            }

            if (locked || card.matched) {
                card.element.setAttribute('aria-disabled', 'true');
            } else {
                card.element.removeAttribute('aria-disabled');
            }
        });
    }

    function syncDifficultyButtons() {
        difficultyButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.difficulty === state.difficulty));
        });
    }

    function focusFirstCard() {
        const firstCard = board.querySelector('.card');
        if (firstCard) {
            firstCard.focus();
        }
    }

    /* ----------------------------------------------------------------------
       Timer
       ---------------------------------------------------------------------- */
    function beginClock() {
        state.status = 'playing';
        state.startedAt = Date.now();
        state.elapsedSeconds = 0;

        if (state.timerId !== null) {
            window.clearInterval(state.timerId);
        }

        state.timerId = window.setInterval(tickClock, CLOCK_TICK);
    }

    function tickClock() {
        if (state.startedAt === null) {
            return;
        }

        const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
        if (seconds === state.elapsedSeconds) {
            return;
        }

        state.elapsedSeconds = seconds;
        timeValue.textContent = formatTime(seconds);
    }

    function stopClock() {
        if (state.timerId !== null) {
            window.clearInterval(state.timerId);
            state.timerId = null;
        }

        if (state.startedAt !== null) {
            state.elapsedSeconds = Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000));
            state.startedAt = null;
        }

        timeValue.textContent = formatTime(state.elapsedSeconds);
    }

    function resetClock() {
        if (state.timerId !== null) {
            window.clearInterval(state.timerId);
            state.timerId = null;
        }

        state.startedAt = null;
        state.elapsedSeconds = 0;
        timeValue.textContent = formatTime(0);
    }

    /* ----------------------------------------------------------------------
       Flip state machine
       ---------------------------------------------------------------------- */
    function flipCard(card, faceUp) {
        card.flipped = faceUp;
        card.element.classList.toggle('is-flipped', faceUp);
        updateCardLabel(card);
    }

    function markMatched(card) {
        card.matched = true;
        card.flipped = true;
        card.element.classList.add('is-matched');
        updateCardLabel(card);
    }

    function selectCard(card) {
        if (!card || state.locked || state.status === 'won' || card.flipped || card.matched) {
            return;
        }

        if (state.status === 'ready') {
            beginClock();
        }

        flipCard(card, true);

        if (!state.firstCard) {
            state.firstCard = card;
            setStatus('Pick one more card.');
            announce(`${card.symbol.name} flipped. Pick a second card.`);
            return;
        }

        state.secondCard = card;
        state.moves += 1;
        updateHud();
        bumpValue(movesValue);

        // Lock the board before evaluating so a third card cannot be flipped.
        setBoardLocked(true);
        evaluateTurn();
    }

    function evaluateTurn() {
        const first = state.firstCard;
        const second = state.secondCard;
        const activeSession = state.session;

        if (!first || !second) {
            return;
        }

        if (first.pairId === second.pairId) {
            markMatched(first);
            markMatched(second);

            state.matchedPairs += 1;
            state.firstCard = null;
            state.secondCard = null;

            updateHud();
            bumpValue(matchesValue);

            const config = getConfig();
            const remaining = config.pairs - state.matchedPairs;

            if (remaining === 0) {
                stopClock();
                state.status = 'won';
                setStatus('Every pair found. Beautiful memory!');

                const result = commitRun(state.elapsedSeconds);

                announce(
                    `All ${pairLabel(config.pairs)} found in ${state.moves} moves and ${describeTime(state.elapsedSeconds)}.`,
                );

                later(() => {
                    if (activeSession !== state.session || state.status !== 'won') {
                        return;
                    }
                    showWinOverlay(result);
                }, WIN_MODAL_DELAY);
                return;
            }

            setStatus(`Match! ${pairLabel(remaining)} to go.`);
            announce(
                `Match. ${first.symbol.name} and ${second.symbol.name}. `
                + `${state.matchedPairs} of ${config.pairs} pairs found.`,
            );

            later(() => {
                if (activeSession !== state.session) {
                    return;
                }
                setBoardLocked(false);
                setStatus(`Match! ${pairLabel(remaining)} to go.`);
            }, MATCH_LOCK_DELAY);

            return;
        }

        first.element.classList.add('is-mismatch');
        second.element.classList.add('is-mismatch');
        setStatus('No match — flipping back.');

        announce(
            `No match. ${first.symbol.name} and ${second.symbol.name}. `
            + 'The cards will flip back.',
        );

        later(() => {
            if (activeSession !== state.session) {
                return;
            }

            first.element.classList.remove('is-mismatch');
            second.element.classList.remove('is-mismatch');

            flipCard(first, false);
            flipCard(second, false);

            state.firstCard = null;
            state.secondCard = null;

            setBoardLocked(false);
            setStatus('Try again. Flip any two cards.');
        }, FLIP_BACK_DELAY);
    }

    /* ----------------------------------------------------------------------
       Round lifecycle
       ---------------------------------------------------------------------- */
    function startGame({ focusBoard = false, message = '' } = {}) {
        clearPendingTimeouts();
        resetClock();
        closeWinOverlay({ restoreFocus: false });
        app.inert = false;

        state.session += 1;

        const config = getConfig();

        state.cards = createDeck(config);
        state.firstCard = null;
        state.secondCard = null;
        state.locked = false;
        state.status = 'ready';
        state.moves = 0;
        state.matchedPairs = 0;

        game.dataset.difficulty = state.difficulty;
        syncDifficultyButtons();
        renderBoard(config);
        setBoardLocked(false);
        updateHud();
        updateRecords();
        setStatus('Flip any card to start the clock.');

        if (message) {
            announce(message);
        }

        if (focusBoard) {
            focusFirstCard();
        }
    }

    /* ----------------------------------------------------------------------
       Win modal, focus & dialogs
       ---------------------------------------------------------------------- */
    function showWinOverlay(result) {
        if (state.status !== 'won') {
            return;
        }

        const config = getConfig();

        winEyebrow.textContent = `${config.label} · ${config.columns} × ${config.rows}`;
        winMoves.textContent = String(state.moves);
        winTime.textContent = formatTime(state.elapsedSeconds);
        winBestMoves.textContent = result.bestMoves === null ? '—' : String(result.bestMoves);
        winBestTime.textContent = result.bestTime === null ? '—' : formatTime(result.bestTime);
        newMovesBadge.hidden = !result.newMoves;
        newTimeBadge.hidden = !result.newTime;

        if (result.newMoves && result.newTime) {
            winNote.textContent = 'New personal best in both categories.';
        } else if (result.newMoves) {
            winNote.textContent = 'New personal best for fewest moves.';
        } else if (result.newTime) {
            winNote.textContent = 'New personal best for fastest time.';
        } else {
            winNote.textContent = 'Your existing records held this round.';
        }

        state.lastFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        winOverlay.hidden = false;
        document.body.classList.add('is-locked');
        app.inert = true;

        window.requestAnimationFrame(() => {
            playAgainButton.focus({ preventScroll: true });
        });
    }

    function closeWinOverlay({ restoreFocus = true, focusTarget = null } = {}) {
        if (winOverlay.hidden) {
            return;
        }

        winOverlay.hidden = true;
        document.body.classList.remove('is-locked');
        app.inert = false;

        const target = focusTarget || (restoreFocus ? state.lastFocused : null);
        state.lastFocused = null;

        if (target && document.contains(target)) {
            window.requestAnimationFrame(() => {
                target.focus({ preventScroll: true });
            });
        }
    }

    function activeDifficultyButton() {
        return difficultyButtons.find(
            (button) => button.dataset.difficulty === state.difficulty,
        ) || difficultyButtons[0];
    }

    function dismissWinOverlay() {
        closeWinOverlay({ focusTarget: activeDifficultyButton() });
        announce('Win dialog closed. Choose a difficulty or restart to play again.');
    }

    function trapFocus(event) {
        const focusable = Array.from(
            winOverlay.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), '
                + 'select:not([disabled]), textarea:not([disabled]), '
                + '[tabindex]:not([tabindex="-1"])',
            ),
        ).filter((element) => !element.hidden && element.offsetParent !== null);

        if (focusable.length === 0) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!winOverlay.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
            return;
        }

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    /* ----------------------------------------------------------------------
       Input handlers
       ---------------------------------------------------------------------- */
    function handleBoardClick(event) {
        const button = event.target.closest('.card');

        if (!button || !board.contains(button)) {
            return;
        }

        const card = state.cards[Number(button.dataset.index)];
        if (card) {
            selectCard(card);
        }
    }

    function handleDifficultyClick(event) {
        const nextDifficulty = event.currentTarget.dataset.difficulty;
        const config = DIFFICULTIES[nextDifficulty];

        if (!config) {
            return;
        }

        // Clicking the active tier mid-round should not wipe a fresh board.
        if (nextDifficulty === state.difficulty && state.status !== 'won') {
            return;
        }

        state.difficulty = nextDifficulty;
        startGame({
            focusBoard: true,
            message: `${config.label} difficulty. ${pairLabel(config.pairs)} on a `
                + `${config.columns} by ${config.rows} board.`,
        });
    }

    function handleGlobalKeydown(event) {
        if (!winOverlay.hidden) {
            if (event.key === 'Escape') {
                event.preventDefault();
                dismissWinOverlay();
            } else if (event.key === 'Tab') {
                trapFocus(event);
            }
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const target = event.target;
        const tagName = target && target.tagName;

        if (
            tagName === 'INPUT'
            || tagName === 'TEXTAREA'
            || tagName === 'SELECT'
            || (target && target.isContentEditable)
        ) {
            return;
        }

        if (event.key.toLowerCase() === 'r') {
            event.preventDefault();
            const config = getConfig();
            startGame({
                focusBoard: true,
                message: `Board reset. ${pairLabel(config.pairs)} ready to find.`,
            });
        }
    }

    /* ----------------------------------------------------------------------
       Initialisation
       ---------------------------------------------------------------------- */
    function init() {
        resetButton.addEventListener('click', () => {
            const config = getConfig();
            startGame({
                focusBoard: true,
                message: `Board reset. ${pairLabel(config.pairs)} ready to find.`,
            });
        });

        difficultyButtons.forEach((button) => {
            button.addEventListener('click', handleDifficultyClick);
        });

        board.addEventListener('click', handleBoardClick);

        playAgainButton.addEventListener('click', () => {
            startGame({
                focusBoard: true,
                message: 'New round started. Flip a card to start the clock.',
            });
        });

        changeDifficultyButton.addEventListener('click', dismissWinOverlay);

        winOverlay.addEventListener('click', (event) => {
            if (event.target === winOverlay) {
                dismissWinOverlay();
            }
        });

        document.addEventListener('keydown', handleGlobalKeydown);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                tickClock();
            }
        });

        startGame();
    }

    init();
})();
