'use strict';

/* ==========================================================================
   Minesweeper — Modern Arcade Edition
   Project 07 · AI Engineering Journey

   Pure Vanilla JavaScript implementation:
   - board matrix generation
   - first-click safety
   - recursive flood fill
   - flagging + live mine counter
   - timer, face states, best-time persistence
   ========================================================================== */

const DIFFICULTIES = Object.freeze({
    beginner: Object.freeze({ label: 'Beginner', rows: 9, cols: 9, mines: 10 }),
    intermediate: Object.freeze({ label: 'Intermediate', rows: 16, cols: 16, mines: 40 }),
    expert: Object.freeze({ label: 'Expert', rows: 16, cols: 30, mines: 99 })
});

const CELL_STATE = Object.freeze({
    HIDDEN: 'hidden',
    REVEALED: 'revealed',
    FLAGGED: 'flagged'
});

const GAME_STATUS = Object.freeze({
    READY: 'ready',
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost'
});

const STORAGE_KEY = 'minesweeper.bestTimes.v1';
const LONG_PRESS_MS = 450;
const MAX_CELL_SIZE = 42;
const MIN_CELL_SIZE = 18;
const CELL_GAP = 3;

class Minesweeper {
    constructor() {
        this.currentDifficulty = 'beginner';
        this.config = DIFFICULTIES.beginner;

        this.rows = 0;
        this.cols = 0;
        this.totalMines = 0;
        this.board = [];

        this.status = GAME_STATUS.READY;
        this.minesPlaced = false;
        this.flagsPlaced = 0;
        this.revealedCount = 0;
        this.explodedCell = null;

        this.elapsed = 0;
        this.timerId = null;
        this.startTime = null;

        this.flagMode = false;
        this.longPressTimer = null;
        this.suppressClick = false;
        this.lastLongPressAt = 0;
        this.resizeFrame = null;

        this.cellElements = [];
        this.bestTimes = this.loadBestTimes();

        this.cacheElements();
        this.bindEvents();
        this.updateBestDisplays();
        this.startNewGame('beginner');
    }

    /* ----------------------------------------------------------------------
       DOM setup
       ---------------------------------------------------------------------- */

    cacheElements() {
        this.boardEl = document.getElementById('board');
        this.boardScroller = document.getElementById('boardScroller');
        this.mineCounterEl = document.getElementById('mineCounter');
        this.timerEl = document.getElementById('timer');
        this.faceButton = document.getElementById('faceButton');
        this.statusMessage = document.getElementById('statusMessage');
        this.bestTimeEl = document.getElementById('bestTime');
        this.difficultyReadout = document.getElementById('difficultyReadout');
        this.flagModeButton = document.getElementById('flagModeBtn');
        this.flagModeState = document.getElementById('flagModeState');
        this.resetRecordsButton = document.getElementById('resetRecordsBtn');

        this.difficultyButtons = Array.from(document.querySelectorAll('[data-difficulty]'));
        this.bestTimeNodes = Array.from(document.querySelectorAll('[data-best]'));
    }

    bindEvents() {
        this.difficultyButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const key = button.dataset.difficulty;
                if (!key || !DIFFICULTIES[key] || key === this.currentDifficulty) {
                    return;
                }
                this.startNewGame(key);
            });
        });

        this.faceButton.addEventListener('click', () => this.startNewGame(this.currentDifficulty));
        this.flagModeButton.addEventListener('click', () => this.setFlagMode(!this.flagMode));
        this.resetRecordsButton.addEventListener('click', () => this.resetBestTimes());

        this.boardEl.addEventListener('click', (event) => this.handleBoardClick(event));
        this.boardEl.addEventListener('contextmenu', (event) => this.handleContextMenu(event));
        this.boardEl.addEventListener('keydown', (event) => this.handleBoardKeydown(event));
        this.boardEl.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.boardEl.addEventListener('pointerleave', () => this.clearLongPress());
        this.boardEl.addEventListener('focusin', (event) => {
            const cellEl = event.target.closest('.cell');
            const coords = cellEl ? this.getCoords(cellEl) : null;
            if (coords) {
                this.setRovingTabindex(coords.row, coords.col);
            }
        });

        window.addEventListener('pointerup', () => {
            this.clearLongPress();
            if (this.status === GAME_STATUS.READY || this.status === GAME_STATUS.PLAYING) {
                this.faceButton.textContent = '😃';
            }
        });
        window.addEventListener('pointercancel', () => this.clearLongPress());
        window.addEventListener('blur', () => this.clearLongPress());
        window.addEventListener('resize', () => this.scheduleCellSizeUpdate());
    }

    /* ----------------------------------------------------------------------
       Game lifecycle
       ---------------------------------------------------------------------- */

    startNewGame(difficultyKey) {
        const key = Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficultyKey)
            ? difficultyKey
            : 'beginner';
        const config = DIFFICULTIES[key];

        this.stopTimer();
        this.clearLongPress();

        this.currentDifficulty = key;
        this.config = config;
        this.rows = config.rows;
        this.cols = config.cols;
        this.totalMines = config.mines;

        this.board = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.cols }, () => ({
                mine: false,
                adjacent: 0,
                state: CELL_STATE.HIDDEN
            }))
        );

        this.status = GAME_STATUS.READY;
        this.minesPlaced = false;
        this.flagsPlaced = 0;
        this.revealedCount = 0;
        this.explodedCell = null;
        this.suppressClick = false;
        this.elapsed = 0;
        this.startTime = null;

        this.faceButton.textContent = '😃';
        this.faceButton.setAttribute('aria-label', 'Start a new game');
        this.timerEl.textContent = '000';
        this.timerEl.setAttribute('aria-label', '0 seconds elapsed');

        this.boardEl.classList.remove('is-won', 'is-lost');
        this.statusMessage.className = 'status-message';
        this.statusMessage.textContent =
            `${config.label} · reveal a tile to start — the first click is always safe.`;

        this.updateMineCounter();
        this.updateBestDisplays();
        this.updateDifficultyUI();
        this.updateFlagModeUI();
        this.renderBoard();
    }

    renderBoard() {
        this.boardEl.innerHTML = '';
        this.boardEl.style.setProperty('--cols', String(this.cols));

        const fragment = document.createDocumentFragment();

        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const cellEl = document.createElement('button');
                cellEl.type = 'button';
                cellEl.className = 'cell cell--hidden';
                cellEl.dataset.row = String(row);
                cellEl.dataset.col = String(col);
                cellEl.tabIndex = row === 0 && col === 0 ? 0 : -1;
                cellEl.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: hidden`);
                cellEl.setAttribute('aria-disabled', 'false');
                fragment.appendChild(cellEl);
            }
        }

        this.boardEl.appendChild(fragment);
        this.cellElements = Array.from(this.boardEl.children);

        this.updateCellSize();
        window.requestAnimationFrame(() => this.updateCellSize());
    }

    updateCellSize() {
        if (!this.cellElements.length || !this.boardScroller) {
            return;
        }

        const gapTotal = CELL_GAP * Math.max(0, this.cols - 1);
        const availableWidth = this.boardScroller.clientWidth - 8;
        const widthBased = Math.floor((availableWidth - gapTotal) / this.cols);
        const size = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, widthBased));

        this.boardEl.style.setProperty('--cell-size', `${size}px`);
    }

    scheduleCellSizeUpdate() {
        if (this.resizeFrame !== null) {
            window.cancelAnimationFrame(this.resizeFrame);
        }

        this.resizeFrame = window.requestAnimationFrame(() => {
            this.resizeFrame = null;
            this.updateCellSize();
        });
    }

    /* ----------------------------------------------------------------------
       Mine generation & first-click safety
       ---------------------------------------------------------------------- */

    beginGame(safeRow, safeCol) {
        this.placeMines(safeRow, safeCol);
        this.minesPlaced = true;
        this.status = GAME_STATUS.PLAYING;
        this.startTimer();
        this.updateMineCounter();

        this.statusMessage.className = 'status-message';
        this.statusMessage.textContent = `${this.config.label} · mines are live. Sweep carefully.`;
    }

    placeMines(safeRow, safeCol) {
        const candidates = [];

        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const inSafeZone =
                    Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1;

                if (!inSafeZone) {
                    candidates.push({ row, col });
                }
            }
        }

        // Fisher-Yates shuffle for an even mine distribution.
        for (let index = candidates.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
        }

        const mineCount = Math.min(this.totalMines, candidates.length);
        for (let index = 0; index < mineCount; index += 1) {
            const { row, col } = candidates[index];
            this.board[row][col].mine = true;
        }

        // Keep the win condition consistent even if a board was unusually small.
        this.totalMines = mineCount;

        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const cell = this.board[row][col];
                if (!cell.mine) {
                    cell.adjacent = this.countAdjacentMines(row, col);
                }
            }
        }
    }

    countAdjacentMines(row, col) {
        let count = 0;
        this.forEachNeighbor(row, col, (neighborRow, neighborCol) => {
            if (this.board[neighborRow][neighborCol].mine) {
                count += 1;
            }
        });
        return count;
    }

    forEachNeighbor(row, col, callback) {
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
            for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
                if (rowOffset === 0 && colOffset === 0) {
                    continue;
                }

                const neighborRow = row + rowOffset;
                const neighborCol = col + colOffset;

                if (this.isInside(neighborRow, neighborCol)) {
                    callback(neighborRow, neighborCol);
                }
            }
        }
    }

    /* ----------------------------------------------------------------------
       Reveal / recursive flood fill
       ---------------------------------------------------------------------- */

    revealAt(row, col) {
        if (this.status === GAME_STATUS.WON || this.status === GAME_STATUS.LOST) {
            return;
        }
        if (!this.isInside(row, col)) {
            return;
        }

        const cell = this.board[row][col];
        if (cell.state !== CELL_STATE.HIDDEN) {
            return;
        }

        if (!this.minesPlaced) {
            this.beginGame(row, col);
        }

        if (cell.mine) {
            this.loseGame(row, col);
            return;
        }

        this.revealCell(row, col);
        this.checkWin();
    }

    /**
     * Recursive flood fill: reveal a cell, then cascade through neighbours
     * whenever the current cell has zero adjacent mines.
     */
    revealCell(row, col) {
        const cell = this.board[row][col];

        if (cell.state !== CELL_STATE.HIDDEN || cell.mine) {
            return;
        }

        cell.state = CELL_STATE.REVEALED;
        this.revealedCount += 1;
        this.updateCell(row, col);

        if (cell.adjacent === 0) {
            this.forEachNeighbor(row, col, (neighborRow, neighborCol) => {
                const neighbor = this.board[neighborRow][neighborCol];
                if (neighbor.state === CELL_STATE.HIDDEN && !neighbor.mine) {
                    this.revealCell(neighborRow, neighborCol);
                }
            });
        }
    }

    checkWin() {
        const safeCells = this.rows * this.cols - this.totalMines;
        if (this.status === GAME_STATUS.PLAYING && this.revealedCount === safeCells) {
            this.winGame();
        }
    }

    /* ----------------------------------------------------------------------
       Win / loss
       ---------------------------------------------------------------------- */

    winGame() {
        this.status = GAME_STATUS.WON;
        this.stopTimer();

        this.faceButton.textContent = '😎';
        this.faceButton.setAttribute('aria-label', 'You won! Start a new game');
        this.boardEl.classList.remove('is-lost');
        this.boardEl.classList.add('is-won');

        // Classic behaviour: flag every remaining mine on victory.
        for (let row = 0; row < this.rows; row += 1) {
            for (let col = 0; col < this.cols; col += 1) {
                const cell = this.board[row][col];
                if (cell.mine && cell.state === CELL_STATE.HIDDEN) {
                    cell.state = CELL_STATE.FLAGGED;
                    this.updateCell(row, col);
                }
            }
        }

        this.flagsPlaced = this.totalMines;
        this.updateMineCounter();
        this.cellElements.forEach((cellEl) => cellEl.setAttribute('aria-disabled', 'true'));

        const isNewBest = this.saveBestTime(this.currentDifficulty, this.elapsed);
        this.updateBestDisplays();

        const timeText = this.formatTime(this.elapsed);
        if (isNewBest) {
            this.statusMessage.textContent =
                `🏆 Field cleared in ${timeText}s — new personal best!`;
        } else {
            const bestText = this.formatTime(this.bestTimes[this.currentDifficulty]);
            this.statusMessage.textContent =
                `🎉 Field cleared in ${timeText}s. Try to beat ${bestText}s.`;
        }
        this.statusMessage.className = 'status-message is-win';
    }

    loseGame(row, col) {
        this.status = GAME_STATUS.LOST;
        this.stopTimer();
        this.explodedCell = { row, col };

        this.faceButton.textContent = '💀';
        this.faceButton.setAttribute('aria-label', 'Game over. Start a new game');
        this.boardEl.classList.remove('is-won');
        this.boardEl.classList.add('is-lost');

        for (let boardRow = 0; boardRow < this.rows; boardRow += 1) {
            for (let boardCol = 0; boardCol < this.cols; boardCol += 1) {
                const cell = this.board[boardRow][boardCol];

                if (cell.mine && cell.state === CELL_STATE.HIDDEN) {
                    cell.state = CELL_STATE.REVEALED;
                    this.updateCell(boardRow, boardCol);
                } else if (cell.state === CELL_STATE.FLAGGED) {
                    // Actual mines stay flagged; incorrect flags are marked below.
                    this.updateCell(boardRow, boardCol);
                }
            }
        }

        this.statusMessage.textContent =
            `💥 Boom! You hit a mine in ${this.formatTime(this.elapsed)}s. Click the face to try again.`;
        this.statusMessage.className = 'status-message is-loss';

        this.cellElements.forEach((cellEl) => cellEl.setAttribute('aria-disabled', 'true'));
    }

    /* ----------------------------------------------------------------------
       Flagging
       ---------------------------------------------------------------------- */

    toggleFlag(row, col) {
        if (this.status === GAME_STATUS.WON || this.status === GAME_STATUS.LOST) {
            return;
        }
        if (!this.isInside(row, col)) {
            return;
        }

        const cell = this.board[row][col];
        if (cell.state === CELL_STATE.REVEALED) {
            return;
        }

        if (cell.state === CELL_STATE.HIDDEN) {
            cell.state = CELL_STATE.FLAGGED;
            this.flagsPlaced += 1;
        } else {
            cell.state = CELL_STATE.HIDDEN;
            this.flagsPlaced = Math.max(0, this.flagsPlaced - 1);
        }

        this.updateCell(row, col);
        this.updateMineCounter();
    }

    updateMineCounter() {
        const remaining = this.totalMines - this.flagsPlaced;
        this.mineCounterEl.textContent = this.formatCounter(remaining);
        this.mineCounterEl.classList.toggle('is-negative', remaining < 0);
        this.mineCounterEl.setAttribute(
            'aria-label',
            remaining < 0
                ? `${Math.abs(remaining)} flags over the mine count`
                : `${remaining} mines remaining`
        );
    }

    /* ----------------------------------------------------------------------
       Timer
       ---------------------------------------------------------------------- */

    startTimer() {
        if (this.timerId !== null) {
            return;
        }

        this.startTime = Date.now() - this.elapsed * 1000;
        this.timerId = window.setInterval(() => {
            if (this.startTime === null) {
                return;
            }
            this.elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.updateTimerDisplay();
        }, 200);
    }

    stopTimer() {
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }

        if (this.startTime !== null) {
            this.elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.startTime = null;
            this.updateTimerDisplay();
        }
    }

    updateTimerDisplay() {
        this.timerEl.textContent = this.formatTime(this.elapsed);
        this.timerEl.setAttribute('aria-label', `${this.elapsed} seconds elapsed`);
    }

    /* ----------------------------------------------------------------------
       Rendering
       ---------------------------------------------------------------------- */

    updateCell(row, col) {
        const cellEl = this.getCellElement(row, col);
        if (!cellEl) {
            return;
        }

        const cell = this.board[row][col];
        const baseLabel = `Row ${row + 1}, column ${col + 1}`;
        const gameEnded = this.status === GAME_STATUS.WON || this.status === GAME_STATUS.LOST;

        cellEl.className = 'cell';
        cellEl.textContent = '';
        cellEl.setAttribute(
            'aria-disabled',
            cell.state === CELL_STATE.REVEALED || gameEnded ? 'true' : 'false'
        );

        if (cell.state === CELL_STATE.FLAGGED) {
            if (this.status === GAME_STATUS.LOST && !cell.mine) {
                cellEl.classList.add('cell--revealed', 'cell--wrong');
                cellEl.textContent = '❌';
                cellEl.setAttribute('aria-label', `${baseLabel}: wrong flag`);
            } else {
                cellEl.classList.add('cell--flagged');
                cellEl.textContent = '🚩';
                cellEl.setAttribute('aria-label', `${baseLabel}: flagged`);
            }
            return;
        }

        if (cell.state === CELL_STATE.HIDDEN) {
            cellEl.classList.add('cell--hidden');
            cellEl.setAttribute('aria-label', `${baseLabel}: hidden`);
            return;
        }

        cellEl.classList.add('cell--revealed');

        if (cell.mine) {
            cellEl.classList.add('cell--mine');
            cellEl.textContent = '💣';
            cellEl.setAttribute('aria-label', `${baseLabel}: mine`);

            if (
                this.explodedCell &&
                this.explodedCell.row === row &&
                this.explodedCell.col === col
            ) {
                cellEl.classList.add('cell--exploded');
                cellEl.setAttribute('aria-label', `${baseLabel}: mine — game over`);
            }
            return;
        }

        if (cell.adjacent > 0) {
            cellEl.classList.add(`cell--n${cell.adjacent}`);
            cellEl.textContent = String(cell.adjacent);
            cellEl.setAttribute(
                'aria-label',
                `${baseLabel}: ${cell.adjacent} adjacent mine${cell.adjacent === 1 ? '' : 's'}`
            );
        } else {
            cellEl.setAttribute('aria-label', `${baseLabel}: empty`);
        }
    }

    updateDifficultyUI() {
        this.difficultyButtons.forEach((button) => {
            const active = button.dataset.difficulty === this.currentDifficulty;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        this.difficultyReadout.textContent =
            `${this.config.label} · ${this.config.cols} × ${this.config.rows}`;
    }

    updateFlagModeUI() {
        this.flagModeButton.classList.toggle('is-active', this.flagMode);
        this.flagModeButton.setAttribute('aria-pressed', String(this.flagMode));
        this.flagModeState.textContent = this.flagMode ? 'On' : 'Off';
        this.boardEl.classList.toggle('is-flag-mode', this.flagMode);
    }

    setFlagMode(enabled) {
        this.flagMode = Boolean(enabled);
        this.updateFlagModeUI();
    }

    setRovingTabindex(row, col) {
        this.cellElements.forEach((cellEl) => {
            cellEl.tabIndex = -1;
        });

        const target = this.getCellElement(row, col);
        if (target) {
            target.tabIndex = 0;
        }
    }

    focusCell(row, col) {
        const target = this.getCellElement(row, col);
        if (!target) {
            return;
        }

        this.setRovingTabindex(row, col);
        target.focus({ preventScroll: true });
        if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    /* ----------------------------------------------------------------------
       Event handlers
       ---------------------------------------------------------------------- */

    handleBoardClick(event) {
        const cellEl = event.target.closest('.cell');
        if (!cellEl || !this.boardEl.contains(cellEl)) {
            return;
        }

        const coords = this.getCoords(cellEl);
        if (!coords) {
            return;
        }

        if (this.suppressClick) {
            this.suppressClick = false;
            return;
        }

        if (this.flagMode) {
            this.toggleFlag(coords.row, coords.col);
            return;
        }

        this.revealAt(coords.row, coords.col);
    }

    handleContextMenu(event) {
        event.preventDefault();

        // A long-press already handled this gesture. Ignore the synthetic
        // contextmenu so the flag is not immediately toggled off again.
        if (this.suppressClick || Date.now() - this.lastLongPressAt < 1000) {
            return;
        }

        const cellEl = event.target.closest('.cell');
        if (!cellEl) {
            return;
        }

        const coords = this.getCoords(cellEl);
        if (coords) {
            this.toggleFlag(coords.row, coords.col);
        }
    }

    handlePointerDown(event) {
        if (event.button !== 0) {
            return;
        }

        const cellEl = event.target.closest('.cell');
        if (!cellEl) {
            return;
        }

        this.suppressClick = false;

        if (this.status === GAME_STATUS.READY || this.status === GAME_STATUS.PLAYING) {
            this.faceButton.textContent = '😮';
        }

        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            return;
        }

        const coords = this.getCoords(cellEl);
        if (!coords) {
            return;
        }

        const cell = this.board[coords.row][coords.col];
        if (cell.state === CELL_STATE.REVEALED) {
            return;
        }

        this.clearLongPress();
        this.longPressTimer = window.setTimeout(() => {
            this.longPressTimer = null;
            this.suppressClick = true;
            this.lastLongPressAt = Date.now();
            this.toggleFlag(coords.row, coords.col);

            if (typeof navigator.vibrate === 'function') {
                navigator.vibrate(18);
            }
        }, LONG_PRESS_MS);
    }

    handleBoardKeydown(event) {
        const cellEl = event.target.closest('.cell');
        if (!cellEl) {
            return;
        }

        const coords = this.getCoords(cellEl);
        if (!coords) {
            return;
        }

        if (event.key === 'f' || event.key === 'F') {
            event.preventDefault();
            this.toggleFlag(coords.row, coords.col);
            return;
        }

        const moves = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1]
        };

        const move = moves[event.key];
        if (!move) {
            return;
        }

        event.preventDefault();
        const nextRow = Math.min(this.rows - 1, Math.max(0, coords.row + move[0]));
        const nextCol = Math.min(this.cols - 1, Math.max(0, coords.col + move[1]));
        this.focusCell(nextRow, nextCol);
    }

    clearLongPress() {
        if (this.longPressTimer !== null) {
            window.clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    /* ----------------------------------------------------------------------
       Helpers
       ---------------------------------------------------------------------- */

    isInside(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    getCellElement(row, col) {
        if (!this.isInside(row, col)) {
            return null;
        }
        return this.cellElements[row * this.cols + col] || null;
    }

    getCoords(cellEl) {
        const row = Number(cellEl.dataset.row);
        const col = Number(cellEl.dataset.col);

        if (!Number.isInteger(row) || !Number.isInteger(col) || !this.isInside(row, col)) {
            return null;
        }

        return { row, col };
    }

    formatCounter(value) {
        if (value < 0) {
            return `-${String(Math.abs(value)).padStart(2, '0')}`;
        }
        return String(value).padStart(3, '0');
    }

    formatTime(seconds) {
        const safeValue = Number.isFinite(seconds)
            ? Math.max(0, Math.min(999, Math.floor(seconds)))
            : 0;
        return String(safeValue).padStart(3, '0');
    }

    /* ----------------------------------------------------------------------
       Best-time persistence
       ---------------------------------------------------------------------- */

    loadBestTimes() {
        const bestTimes = { beginner: null, intermediate: null, expert: null };

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return bestTimes;
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return bestTimes;
            }

            Object.keys(bestTimes).forEach((key) => {
                const value = parsed[key];
                if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
                    bestTimes[key] = Math.floor(value);
                }
            });
        } catch (error) {
            // Storage can be unavailable in private mode or when blocked.
        }

        return bestTimes;
    }

    persistBestTimes() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bestTimes));
        } catch (error) {
            // Persistence is a progressive enhancement; never break gameplay.
        }
    }

    saveBestTime(difficultyKey, seconds) {
        const currentBest = this.bestTimes[difficultyKey];

        if (currentBest === null || currentBest === undefined || seconds < currentBest) {
            this.bestTimes[difficultyKey] = Math.max(0, Math.floor(seconds));
            this.persistBestTimes();
            return true;
        }

        return false;
    }

    updateBestDisplays() {
        const currentBest = this.bestTimes[this.currentDifficulty];
        this.bestTimeEl.textContent =
            currentBest === null || currentBest === undefined
                ? '--'
                : `${this.formatTime(currentBest)}s`;

        this.bestTimeNodes.forEach((node) => {
            const key = node.dataset.best;
            const value = this.bestTimes[key];
            node.textContent =
                value === null || value === undefined
                    ? '--'
                    : `${this.formatTime(value)}s`;
        });
    }

    resetBestTimes() {
        const confirmed = window.confirm('Clear all saved best times for every difficulty?');
        if (!confirmed) {
            return;
        }

        this.bestTimes = { beginner: null, intermediate: null, expert: null };
        this.persistBestTimes();
        this.updateBestDisplays();

        if (this.status === GAME_STATUS.READY || this.status === GAME_STATUS.PLAYING) {
            this.statusMessage.textContent = 'Best times cleared. A fresh scoreboard awaits.';
            this.statusMessage.className = 'status-message';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Minesweeper();
});
