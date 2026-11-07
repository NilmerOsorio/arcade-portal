/* ==========================================================================
   2048 — Sliding Tile Puzzle
   Project 10 · Matrix algorithms, slide/merge engine, input & game state
   ========================================================================== */

(() => {
    'use strict';

    /* ----------------------------------------------------------------------
       Constants & DOM references
       ---------------------------------------------------------------------- */
    const SIZE = 4;
    const WINNING_VALUE = 2048;
    const STORAGE_KEY = 'game2048.best.v1';
    const MOVE_MS = 250; // Keep in sync with --move-duration in style.css.
    const SWIPE_MIN = 24;
    const SPAWN_FOUR_CHANCE = 0.1;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    const scoreValue = document.getElementById('scoreValue');
    const bestValue = document.getElementById('bestValue');
    const scoreCard = document.getElementById('scoreCard');
    const bestCard = document.getElementById('bestCard');

    const board = document.getElementById('board');
    const tileLayer = document.getElementById('tileLayer');
    const announcer = document.getElementById('announcer');
    const boardSummary = document.getElementById('boardSummary');

    const newGameButton = document.getElementById('newGameButton');

    const winOverlay = document.getElementById('winOverlay');
    const winScore = document.getElementById('winScore');
    const keepPlayingButton = document.getElementById('keepPlayingButton');
    const winRestartButton = document.getElementById('winRestartButton');

    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const finalScore = document.getElementById('finalScore');
    const finalBest = document.getElementById('finalBest');
    const newBestBadge = document.getElementById('newBestBadge');
    const restartButton = document.getElementById('restartButton');

    const numberFormatter = new Intl.NumberFormat('en-US');

    const KEY_DIRECTIONS = {
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
    };

    /* ----------------------------------------------------------------------
       Game state
       ---------------------------------------------------------------------- */
    const state = {
        grid: createEmptyGrid(),
        score: 0,
        best: readBestScore(),
        won: false,
        over: false,
        busy: false,
        newBest: false,
        nextId: 1,
        lastFocused: null,
    };

    const tileElements = new Map();
    let session = 0;
    let swipeOrigin = null;
    let pendingSlide = null;

    /* ----------------------------------------------------------------------
       Small helpers
       ---------------------------------------------------------------------- */
    function createEmptyGrid() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    }

    function formatScore(value) {
        return numberFormatter.format(value);
    }

    function readBestScore() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const parsed = Number.parseInt(raw ?? '', 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        } catch (error) {
            return 0;
        }
    }

    function writeBestScore(value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(value));
        } catch (error) {
            /* Storage may be unavailable (private mode); the in-memory best still works. */
        }
    }

    function anyOverlayOpen() {
        return !winOverlay.hidden || !gameOverOverlay.hidden;
    }

    function announce(message) {
        announcer.textContent = '';
        window.requestAnimationFrame(() => {
            announcer.textContent = message;
        });
    }

    function bump(element) {
        if (!element) {
            return;
        }
        element.classList.remove('is-bumped');
        void element.offsetWidth;
        element.classList.add('is-bumped');
        element.addEventListener('animationend', () => {
            element.classList.remove('is-bumped');
        }, { once: true });
    }

    /* ----------------------------------------------------------------------
       Tile rendering
       ---------------------------------------------------------------------- */
    function tileClass(value) {
        const base = value <= WINNING_VALUE ? `tile--${value}` : 'tile--super';
        const digitCount = Math.min(String(value).length, 5);
        return `${base} tile--len-${digitCount}`;
    }

    function positionTile(element, row, column) {
        element.style.setProperty('--row', String(row));
        element.style.setProperty('--column', String(column));
        element.dataset.row = String(row);
        element.dataset.column = String(column);
    }

    function createTileElement(tile, row, column, variant) {
        const element = document.createElement('div');
        element.className = `tile ${tileClass(tile.value)}`;
        element.dataset.id = String(tile.id);

        if (variant === 'new') {
            element.classList.add('tile--new');
        } else if (variant === 'merged') {
            element.classList.add('tile--merged');
        }

        positionTile(element, row, column);

        const value = document.createElement('span');
        value.className = 'tile__value';
        value.textContent = String(tile.value);
        element.appendChild(value);

        tileLayer.appendChild(element);
        tileElements.set(tile.id, element);
        return element;
    }

    function clearTileElements() {
        tileElements.forEach((element) => element.remove());
        tileElements.clear();
        tileLayer.textContent = '';
    }

    function renderFullGrid(variant) {
        clearTileElements();
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const tile = state.grid[row][column];
                if (tile) {
                    createTileElement(tile, row, column, variant);
                }
            }
        }
    }

    function refreshBoardSummary() {
        const rows = state.grid.map((row) => row
            .map((tile) => (tile ? tile.value : 'blank'))
            .join(', '));
        boardSummary.textContent = `Board from top row to bottom row: ${rows.join('; ')}. Current score ${state.score}.`;
    }

    /* ----------------------------------------------------------------------
       Random spawner
       ---------------------------------------------------------------------- */
    function addRandomTile(grid) {
        const emptyCells = [];

        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                if (!grid[row][column]) {
                    emptyCells.push([row, column]);
                }
            }
        }

        if (emptyCells.length === 0) {
            return null;
        }

        const [row, column] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const tile = {
            id: state.nextId,
            value: Math.random() < SPAWN_FOUR_CHANCE ? 4 : 2,
        };
        state.nextId += 1;
        grid[row][column] = tile;

        return { tile, row, column };
    }

    /* ----------------------------------------------------------------------
       Matrix algorithms
       ---------------------------------------------------------------------- */
    function buildLines(direction) {
        const lines = [];

        for (let index = 0; index < SIZE; index += 1) {
            const line = [];

            for (let step = 0; step < SIZE; step += 1) {
                let row;
                let column;

                if (direction === 'left') {
                    row = index;
                    column = step;
                } else if (direction === 'right') {
                    row = index;
                    column = SIZE - 1 - step;
                } else if (direction === 'up') {
                    row = step;
                    column = index;
                } else {
                    row = SIZE - 1 - step;
                    column = index;
                }

                line.push({ row, column, tile: state.grid[row][column] });
            }

            lines.push(line);
        }

        return lines;
    }

    /*
     * Computes a move without mutating the live grid.
     * Each line is read from the movement edge inward, compressed, and merged
     * in a single pass. A tile can only participate in one merge per move,
     * which is why the loop skips the consumed neighbour after a merge.
     */
    function computeMove(direction) {
        const lines = buildLines(direction);
        const nextGrid = createEmptyGrid();
        const moves = [];
        const mergedTiles = [];
        let gained = 0;
        let changed = false;

        for (const line of lines) {
            const filled = line.filter((cell) => cell.tile);
            const results = [];

            for (let index = 0; index < filled.length; index += 1) {
                const current = filled[index];
                const next = filled[index + 1];

                if (next && next.tile.value === current.tile.value) {
                    results.push({
                        value: current.tile.value * 2,
                        sources: [current, next],
                        merged: true,
                    });
                    gained += current.tile.value * 2;
                    changed = true;
                    index += 1;
                } else {
                    results.push({
                        value: current.tile.value,
                        sources: [current],
                        merged: false,
                    });
                }
            }

            results.forEach((result, targetIndex) => {
                const target = line[targetIndex];
                let tile;

                if (result.merged) {
                    tile = { id: state.nextId, value: result.value };
                    state.nextId += 1;
                    changed = true;
                } else {
                    tile = result.sources[0].tile;
                }

                nextGrid[target.row][target.column] = tile;

                result.sources.forEach((source) => {
                    if (source.row !== target.row || source.column !== target.column) {
                        changed = true;
                    }
                    moves.push({
                        id: source.tile.id,
                        row: target.row,
                        column: target.column,
                    });
                });

                if (result.merged) {
                    mergedTiles.push({
                        tile,
                        row: target.row,
                        column: target.column,
                        sourceIds: result.sources.map((source) => source.tile.id),
                    });
                }
            });
        }

        return { grid: nextGrid, moves, mergedTiles, gained, changed };
    }

    function hasWinningTile(grid) {
        return grid.some((row) => row.some((tile) => tile && tile.value >= WINNING_VALUE));
    }

    function hasAvailableMoves(grid) {
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const tile = grid[row][column];

                if (!tile) {
                    return true;
                }

                const right = column + 1 < SIZE ? grid[row][column + 1] : null;
                if (right && tile.value === right.value) {
                    return true;
                }

                const below = row + 1 < SIZE ? grid[row + 1][column] : null;
                if (below && tile.value === below.value) {
                    return true;
                }
            }
        }
        return false;
    }

    /* ----------------------------------------------------------------------
       Score & best score
       ---------------------------------------------------------------------- */
    function refreshScore() {
        scoreValue.textContent = formatScore(state.score);
        bump(scoreCard);

        if (state.score > state.best) {
            state.best = state.score;
            state.newBest = true;
            writeBestScore(state.best);
            bestValue.textContent = formatScore(state.best);
            bump(bestCard);
        }
    }

    function refreshBest() {
        bestValue.textContent = formatScore(state.best);
    }

    /* ----------------------------------------------------------------------
       Move pipeline
       ---------------------------------------------------------------------- */
    /*
     * Waits for every moving tile's transform transition to finish before the
     * merge swap and spawn happen. The fallback covers browsers/frames where a
     * transitionend event can be dropped, so the game can never stay locked.
     */
    function beginSlide(movedIds, onComplete) {
        if (pendingSlide) {
            pendingSlide.cancel();
        }

        if (movedIds.length === 0) {
            window.requestAnimationFrame(onComplete);
            return;
        }

        const pending = new Set(movedIds);
        let timerId = 0;
        let settled = false;

        function cleanup() {
            tileLayer.removeEventListener('transitionend', handleTransitionEnd);
            window.clearTimeout(timerId);
            pendingSlide = null;
        }

        function finish() {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            onComplete();
        }

        function cancel() {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
        }

        function handleTransitionEnd(event) {
            if (event.propertyName !== 'transform') {
                return;
            }

            const tileId = Number(event.target.dataset.id);
            if (!pending.has(tileId)) {
                return;
            }

            pending.delete(tileId);
            if (pending.size === 0) {
                finish();
            }
        }

        tileLayer.addEventListener('transitionend', handleTransitionEnd);
        timerId = window.setTimeout(
            finish,
            motionPreference.matches ? 16 : MOVE_MS + 90,
        );
        pendingSlide = { cancel };
    }

    function cancelPendingSlide() {
        if (pendingSlide) {
            pendingSlide.cancel();
        }
    }

    function nudgeBoard() {
        board.classList.remove('board--nudge');
        void board.offsetWidth;
        board.classList.add('board--nudge');
    }

    function handleMove(direction) {
        if (state.busy || state.over || anyOverlayOpen()) {
            return;
        }

        const result = computeMove(direction);

        if (!result.changed) {
            nudgeBoard();
            return;
        }

        state.busy = true;
        const activeSession = session;
        const movingTiles = [];

        result.moves.forEach((move) => {
            const element = tileElements.get(move.id);
            if (!element) {
                return;
            }

            const currentRow = Number(element.dataset.row);
            const currentColumn = Number(element.dataset.column);

            if (currentRow !== move.row || currentColumn !== move.column) {
                movingTiles.push({ element, move });
            }
        });

        // Register the transition listener before applying the destination
        // coordinates; the browser still uses the rendered transform as the
        // starting point, so the glide begins on the next style flush.
        beginSlide(movingTiles.map(({ move }) => move.id), () => {
            if (activeSession !== session) {
                return;
            }
            finishMove(result);
        });

        movingTiles.forEach(({ element, move }) => {
            positionTile(element, move.row, move.column);
        });

        state.grid = result.grid;

        if (result.gained > 0) {
            state.score += result.gained;
            refreshScore();
        }
    }

    function finishMove(result) {
        result.mergedTiles.forEach((merged) => {
            merged.sourceIds.forEach((id) => {
                const element = tileElements.get(id);
                if (element) {
                    element.remove();
                    tileElements.delete(id);
                }
            });

            createTileElement(merged.tile, merged.row, merged.column, 'merged');
        });

        const spawn = addRandomTile(state.grid);
        if (spawn) {
            createTileElement(spawn.tile, spawn.row, spawn.column, 'new');
        }

        state.busy = false;
        refreshBoardSummary();

        const wonNow = !state.won && hasWinningTile(state.grid);
        const noMovesLeft = !hasAvailableMoves(state.grid);
        state.over = noMovesLeft;

        if (wonNow) {
            state.won = true;
            announce(`You reached ${WINNING_VALUE}! Score ${state.score}.`);
            showWinOverlay();
        } else if (noMovesLeft) {
            announce(`Game over. Final score ${state.score}.`);
            showGameOverOverlay();
        } else if (result.gained > 0) {
            announce(`Merged for ${result.gained} points. Score ${state.score}.`);
        }
    }

    /* ----------------------------------------------------------------------
       Game lifecycle
       ---------------------------------------------------------------------- */
    function resetGame({ focusBoard = true } = {}) {
        session += 1;
        cancelPendingSlide();
        state.grid = createEmptyGrid();
        state.score = 0;
        state.won = false;
        state.over = false;
        state.busy = false;
        state.newBest = false;
        state.nextId = 1;
        swipeOrigin = null;

        hideAllOverlays();
        clearTileElements();
        board.classList.remove('board--nudge');

        addRandomTile(state.grid);
        addRandomTile(state.grid);
        renderFullGrid('new');

        scoreValue.textContent = '0';
        refreshBest();
        refreshBoardSummary();
        announce('New game started. Slide the tiles to begin.');

        if (focusBoard) {
            board.focus({ preventScroll: true });
        }
    }

    /* ----------------------------------------------------------------------
       Overlays, focus & dialogs
       ---------------------------------------------------------------------- */
    function showOverlay(overlay, focusTarget) {
        const active = document.activeElement;
        state.lastFocused = active instanceof HTMLElement ? active : null;
        overlay.hidden = false;
        document.body.classList.add('is-locked');

        if (focusTarget) {
            focusTarget.focus({ preventScroll: true });
        }
    }

    function hideOverlay(overlay) {
        overlay.hidden = true;

        if (!anyOverlayOpen()) {
            document.body.classList.remove('is-locked');
        }

        const target = state.lastFocused;
        state.lastFocused = null;

        if (target && document.contains(target)) {
            target.focus({ preventScroll: true });
        }
    }

    function hideAllOverlays() {
        winOverlay.hidden = true;
        gameOverOverlay.hidden = true;
        document.body.classList.remove('is-locked');
        state.lastFocused = null;
    }

    function showWinOverlay() {
        winScore.textContent = formatScore(state.score);
        showOverlay(winOverlay, keepPlayingButton);
    }

    function showGameOverOverlay() {
        finalScore.textContent = formatScore(state.score);
        finalBest.textContent = formatScore(state.best);
        newBestBadge.hidden = !state.newBest;
        showOverlay(gameOverOverlay, restartButton);
    }

    function keepPlaying() {
        if (winOverlay.hidden) {
            return;
        }

        hideOverlay(winOverlay);

        if (state.over) {
            showGameOverOverlay();
            return;
        }

        board.focus({ preventScroll: true });
        announce('Keep playing. The board is yours.');
    }

    function trapFocus(event) {
        const overlay = !winOverlay.hidden ? winOverlay : gameOverOverlay;
        const focusable = Array.from(
            overlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
        ).filter((element) => element.offsetParent !== null);

        if (focusable.length === 0) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

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
    function handleKeydown(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (anyOverlayOpen()) {
            if (event.key === 'Escape' && !winOverlay.hidden) {
                event.preventDefault();
                keepPlaying();
            } else if (event.key === 'Tab') {
                trapFocus(event);
            }
            return;
        }

        const tagName = event.target && event.target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
            || (event.target && event.target.isContentEditable)) {
            return;
        }

        const direction = KEY_DIRECTIONS[event.key.toLowerCase()];
        if (!direction) {
            return;
        }

        event.preventDefault();
        handleMove(direction);
    }

    function handleTouchStart(event) {
        if (event.touches.length !== 1 || state.busy || state.over || anyOverlayOpen()) {
            swipeOrigin = null;
            return;
        }

        const touch = event.touches[0];
        swipeOrigin = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(event) {
        if (!swipeOrigin) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - swipeOrigin.x;
        const deltaY = touch.clientY - swipeOrigin.y;
        swipeOrigin = null;

        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_MIN) {
            return;
        }

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            handleMove(deltaX > 0 ? 'right' : 'left');
        } else {
            handleMove(deltaY > 0 ? 'down' : 'up');
        }
    }

    /* ----------------------------------------------------------------------
       Initialisation
       ---------------------------------------------------------------------- */
    function init() {
        document.addEventListener('keydown', handleKeydown);

        newGameButton.addEventListener('click', () => resetGame());
        restartButton.addEventListener('click', () => resetGame());
        winRestartButton.addEventListener('click', () => resetGame());
        keepPlayingButton.addEventListener('click', keepPlaying);

        board.addEventListener('touchstart', handleTouchStart, { passive: true });
        board.addEventListener('touchend', handleTouchEnd, { passive: true });
        board.addEventListener('touchcancel', () => {
            swipeOrigin = null;
        });

        board.addEventListener('animationend', (event) => {
            if (event.animationName === 'board-nudge') {
                board.classList.remove('board--nudge');
            }
        });

        resetGame({ focusBoard: false });
    }

    init();
})();
