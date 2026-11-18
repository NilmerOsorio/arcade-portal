const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Bind the shipped script to the actual page's controls and a manual clock.
function boot(random = Math.random) {
    const elements = new Map();
    const cells = [];
    for (const tag of html.matchAll(/<[a-z][\w-]*\b([^>]*)>([^<]*)/gi)) {
        const attrs = Object.fromEntries([...tag[1].matchAll(/([\w-]+)="([^"]*)"/g)]
            .map(([, key, value]) => [key, value]));
        const classes = new Set((attrs.class || '').split(/\s+/));
        const listeners = new Map();
        const element = {
            textContent: tag[2].trim(), dataset: { cellIndex: attrs['data-cell-index'] },
            classList: {
                contains: name => classes.has(name),
                toggle(name, on) { on ? classes.add(name) : classes.delete(name); }
            },
            setAttribute(name, value) { attrs[name] = String(value); },
            getAttribute(name) { return attrs[name]; },
            addEventListener(type, handler) { listeners.set(type, handler); },
            click() { listeners.get('click')({ currentTarget: element, target: element }); }
        };
        if (attrs.id) elements.set(attrs.id, element);
        if (classes.has('cell')) cells.push(element);
    }
    assert.equal(cells.length, 9);
    const get = id => elements.get(id);
    let start;
    const document = {
        getElementById: get,
        querySelectorAll(selector) { assert.equal(selector, '.cell'); return cells; },
        addEventListener(type, callback) { assert.equal(type, 'DOMContentLoaded'); start = callback; }
    };
    let now = 0;
    let nextTimer = 0;
    const timers = new Map();
    const clock = {
        setTimeout(callback, delay) {
            timers.set(++nextTimer, { due: now + delay, callback });
            return nextTimer;
        },
        clearTimeout(id) { timers.delete(id); }
    };
    const math = Object.create(Math, { random: { value: random } });
    const Game = vm.runInNewContext(source + '\nTicTacToe', { document, Math: math, window: clock, ...clock });
    return {
        get, cells, start, Game,
        play: (...moves) => moves.forEach(index => cells[index].click()),
        scores: () => ['scoreX', 'scoreO', 'scoreTie'].map(id => Number(get(id).textContent)),
        advance(milliseconds) {
            now += milliseconds;
            for (const [id, { due, callback }] of [...timers]) {
                if (due > now) continue;
                timers.delete(id);
                callback();
            }
        }
    };
}

test('PvP alternates players, highlights wins, counts ties and preserves scores between rounds', () => {
    const ui = boot();
    ui.start();
    ui.play(0, 0, 3, 1, 4, 2); // Clicking an occupied cell must not advance the turn.
    assert.deepEqual(ui.cells.slice(0, 6).map(cell => cell.textContent), ['X', 'X', 'X', 'O', 'O', '']);
    assert.deepEqual(ui.cells.filter(cell => cell.classList.contains('winning')), ui.cells.slice(0, 3));
    assert.ok(ui.cells.every(cell => cell.disabled));
    ui.play(8);
    assert.deepEqual(ui.scores(), [1, 0, 0]);
    ui.get('resetRoundBtn').click();
    assert.ok(ui.cells.every(cell => !cell.disabled && !cell.classList.contains('winning')));
    ui.play(0, 2, 1, 4, 8, 6);
    assert.deepEqual(ui.scores(), [1, 1, 0]);
    ui.get('resetRoundBtn').click();
    ui.play(0, 1, 2, 4, 3, 5, 7, 6, 8);
    assert.deepEqual(ui.scores(), [1, 1, 1]);
    assert.match(ui.get('statusText').textContent, /tie|draw/i);
    ui.get('modePvc').click();
    assert.deepEqual(ui.scores(), [1, 1, 1]);
    ui.get('resetScoresBtn').click();
    assert.deepEqual(ui.scores(), [0, 0, 0]);
    assert.ok(ui.cells.every(cell => cell.textContent === '' && !cell.disabled));
});

test('PvC locks input during computer turns and credits the computer for a win', () => {
    const ui = boot();
    ui.start();
    ui.get('modePvc').click();
    assert.equal(ui.get('modePvc').getAttribute('aria-pressed'), 'true');
    assert.equal(ui.get('scoreOLabel').textContent, 'Computer');
    ui.play(0);
    assert.ok(ui.cells.every(cell => cell.disabled));
    ui.play(8); // Even a dispatched click during the delay must be ignored.
    ui.advance(600);
    assert.equal(ui.cells[4].textContent, 'O');
    assert.equal(ui.cells[8].textContent, '');
    assert.match(ui.cells[4].getAttribute('aria-label'), /row 2, column 2, O/i);
    assert.equal(ui.cells.filter(cell => !cell.disabled).length, 7);
    ui.play(1);
    ui.advance(600);
    ui.play(3);
    ui.advance(600);
    assert.match(ui.get('statusText').textContent, /computer.*win/i);
    assert.deepEqual(ui.scores(), [0, 1, 0]);
    assert.ok(ui.cells.every(cell => cell.disabled));
});

test('round reset, score reset and mode switch discard pending computer replies', () => {
    for (const control of ['resetRoundBtn', 'resetScoresBtn', 'modePvp']) {
        const ui = boot();
        ui.start();
        ui.get('modePvc').click();
        ui.play(0);
        ui.advance(300);
        ui.get(control).click();
        assert.ok(ui.cells.every(cell => !cell.disabled && cell.textContent === ''), control);
        ui.play(8);
        ui.advance(300); // Old reply would fire during the new round's thinking time.
        assert.equal(ui.cells.filter(cell => cell.textContent === 'O').length, 0, control);
        ui.advance(300);
        assert.equal(ui.cells.filter(cell => cell.textContent === 'O').length, control === 'modePvp' ? 0 : 1);
    }
});

// Construct the finite game table independently, using immutable board strings.
// Values are from the side to move's perspective. An earlier win is worth more.
function solvePositions() {
    const positions = new Map();
    const lines = ['012', '345', '678', '036', '147', '258', '048', '246'];
    function solve(board, player) {
        if (positions.has(board)) return positions.get(board).score;
        const empty = [...board].filter(mark => mark === '.').length;
        const won = lines.some(([a, b, c]) => board[a] !== '.' && board[a] === board[b] && board[b] === board[c]);
        const position = { player, score: 0, moves: [] };
        if (won) {
            position.score = -1 - empty;
        } else if (empty) {
            position.score = -Infinity;
            for (let index = 0; index < board.length; index++) {
                if (board[index] !== '.') continue;
                const child = board.slice(0, index) + player + board.slice(index + 1);
                const score = -solve(child, player === 'X' ? 'O' : 'X');
                if (score > position.score) {
                    position.score = score;
                    position.moves = [];
                }
                if (score === position.score) position.moves.push(index);
            }
        }
        positions.set(board, position);
        return position.score;
    }
    assert.equal(Math.abs(solve('.........', 'X')), 0);
    return positions;
}

test('the computer chooses an optimal move at every legal O turn and leaves the board intact', () => {
    let roll = 0;
    const { Game } = boot(() => roll);
    const game = new Game();
    const positions = solvePositions();
    let tested = 0;
    for (const [board, { player, moves }] of positions) {
        if (player !== 'O' || !moves.length) continue;
        const marks = [...board].map(mark => mark === '.' ? '' : mark);
        game.board = [...marks];
        // These rolls cover every possible tie-break slot, even if all empty cells tie.
        const slots = marks.filter(mark => !mark).length;
        for (let slot = 0; slot < slots; slot++) {
            roll = (slot + 0.5) / slots;
            const choice = game.getComputerMove();
            assert.ok(moves.includes(choice), `${board}: expected one of ${moves}, received ${choice}`);
            assert.deepEqual(game.board, marks);
        }
        tested++;
    }
    assert.equal(positions.size, 5478);
    assert.equal(tested, 2097);
});
