const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Exercise the shipped script and its event wiring without a browser dependency.
// Only the test copy exposes closure state; rendering/layout require browser QA.
function boot() {
    const elements = [];
    let document;
    function element(tagName, attributes = {}) {
        const listeners = new Map();
        const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
        const node = {
            tagName: tagName.toUpperCase(), attributes, dataset: {}, hidden: false,
            disabled: false, textContent: '', offsetWidth: 100, offsetParent: {},
            classList: {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name),
                toggle(name, enabled = !classes.has(name)) {
                    enabled ? classes.add(name) : classes.delete(name);
                    return enabled;
                }
            },
            addEventListener(type, callback) {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type).push(callback);
            },
            dispatch(type, detail = {}) {
                const event = {
                    target: node, currentTarget: node, repeat: false, defaultPrevented: false,
                    preventDefault() { this.defaultPrevented = true; }, ...detail
                };
                for (const callback of listeners.get(type) || []) callback(event);
                return event;
            },
            setAttribute(name, value) { attributes[name] = String(value); },
            getAttribute(name) { return attributes[name] ?? null; },
            hasAttribute(name) { return Object.hasOwn(attributes, name); },
            removeAttribute(name) { delete attributes[name]; },
            focus() { document.activeElement = node; },
            matches(selector) {
                return selector.split(',').some(part => {
                    part = part.trim();
                    if (part.startsWith('.')) return part.slice(1).split('.').every(c => classes.has(c));
                    if (part === '[contenteditable]') return Object.hasOwn(attributes, 'contenteditable');
                    return part.split('[')[0].toUpperCase() === node.tagName;
                });
            },
            closest(selector) { return node.matches(selector) ? node : null; },
            setPointerCapture() {}, releasePointerCapture() {},
            getBoundingClientRect() { return { left: 20, top: 40, width: 500, height: 300 }; }
        };
        Object.defineProperty(node, 'className', {
            get: () => [...classes].join(' '),
            set(value) { classes.clear(); value.split(/\s+/).forEach(c => classes.add(c)); }
        });
        for (const [name, value] of Object.entries(attributes)) {
            if (name.startsWith('data-')) node.dataset[name.slice(5)] = value;
        }
        elements.push(node);
        return node;
    }
    for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
        const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)]
            .map(attribute => [attribute[1], attribute[2]]));
        element(match[1], attributes);
    }
    const context = new Proxy({}, {
        get(target, name) {
            if (name in target) return target[name];
            if (name === 'createLinearGradient' || name === 'createRadialGradient') {
                return () => ({ addColorStop() {} });
            }
            return () => {};
        }
    });
    const get = id => elements.find(node => node.attributes.id === id);
    get('gameCanvas').getContext = () => context;
    document = element('document');
    document.getElementById = get;
    document.querySelectorAll = selector => elements.filter(node => node.matches(selector));
    document.querySelector = selector => {
        if (selector.endsWith(' .score-panel__tag')) {
            return document.querySelectorAll('.score-panel__tag')[selector.includes('--right') ? 1 : 0];
        }
        return document.querySelectorAll(selector)[0] || null;
    };
    document.activeElement = get('gameCanvas');
    const window = element('window');
    window.devicePixelRatio = 2;
    window.requestAnimationFrame = callback => {
        if (callback.name !== 'frame') callback(0);
        return 1;
    };
    window.setTimeout = () => 1;
    window.clearTimeout = () => {};
    const sandbox = { document, window, console };
    const exports = 'WORLD, CONFIG, state, leftPaddle, rightPaddle, ball, keys, touchDrag, ' +
        'touchHeld, updatePlayerPaddles, stepSimulation, resolveWalls, resolvePaddle, frame';
    const bootPosition = source.lastIndexOf('    init();');
    assert.ok(bootPosition > 0, 'Game boot entry must exist');
    vm.runInNewContext(source.slice(0, bootPosition) +
        `    globalThis.game = { ${exports} };\n` + source.slice(bootPosition), sandbox);
    const game = sandbox.game;
    const key = (type, code, target = get('gameCanvas')) => document.dispatch(type, { code, key: code, target });
    const start = (mode = 'pvp') => {
        document.querySelectorAll('.mode-card').find(button => button.dataset.mode === mode).dispatch('click');
        get('startButton').dispatch('click');
    };
    const touch = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
    return { ...game, document, window, get, key, start, touch };
}

test('PvP supports simultaneous movement, opposing keys, release, and paddle bounds', () => {
    const g = boot();
    g.start();
    const initial = g.leftPaddle.y;
    g.key('keydown', 'KeyW');
    assert.ok(g.key('keydown', 'ArrowDown').defaultPrevented);
    g.updatePlayerPaddles(0.1);
    assert.equal(g.leftPaddle.y, initial - 66);
    assert.equal(g.rightPaddle.y, initial + 66);
    g.key('keydown', 'KeyS');
    g.updatePlayerPaddles(0.1);
    assert.equal(g.leftPaddle.y, initial - 66);
    g.key('keyup', 'KeyW');
    g.updatePlayerPaddles(10);
    assert.equal(g.leftPaddle.y, g.WORLD.height - g.leftPaddle.height);
    assert.equal(g.rightPaddle.y, g.WORLD.height - g.rightPaddle.height);
    g.key('keyup', 'KeyS');
    g.key('keyup', 'ArrowDown');
    assert.equal(g.keys.size, 0);
});

test('PvC maps both W/S and arrows to the player and leaves the computer independent', () => {
    for (const [up, down] of [['KeyW', 'KeyS'], ['ArrowUp', 'ArrowDown']]) {
        const g = boot();
        g.start('pvc');
        const initial = g.leftPaddle.y;
        g.key('keydown', up);
        g.updatePlayerPaddles(0.1);
        assert.equal(g.leftPaddle.y, initial - 66);
        assert.equal(g.rightPaddle.y, initial);
        g.key('keyup', up);
        g.key('keydown', down);
        g.updatePlayerPaddles(0.1);
        assert.equal(g.leftPaddle.y, initial);
        assert.equal(g.rightPaddle.y, initial);
        assert.ok(g.get('touchControls').classList.contains('is-solo'));
    }
});

test('two canvas touches steer separate paddles through crossing, release, and cancellation', () => {
    const g = boot();
    g.start();
    const canvas = g.get('gameCanvas');
    const event = canvas.dispatch('touchstart', {
        changedTouches: [g.touch(1, 80, 100), g.touch(2, 450, 280)]
    });
    assert.ok(event.defaultPrevented);
    for (let i = 0; i < 60; i++) g.updatePlayerPaddles(1 / 120);
    assert.ok(Math.abs(g.leftPaddle.y + g.leftPaddle.height / 2 - 120) < 1);
    assert.ok(Math.abs(g.rightPaddle.y + g.rightPaddle.height / 2 - 480) < 1);
    canvas.dispatch('touchmove', { changedTouches: [g.touch(1, 450, 150), g.touch(2, 80, 200)] });
    assert.ok(Math.abs(g.touchDrag.left.targetY - 220) < 1e-8);
    assert.ok(Math.abs(g.touchDrag.right.targetY - 320) < 1e-8);
    canvas.dispatch('touchend', { changedTouches: [g.touch(1, 450, 150)] });
    assert.equal(g.touchDrag.left.id, null);
    assert.equal(g.touchDrag.right.id, 2);
    canvas.dispatch('touchcancel', { changedTouches: [g.touch(2, 80, 200)] });
    assert.equal(g.touchDrag.right.id, null);
    const lastY = g.leftPaddle.y;
    g.updatePlayerPaddles(0.1);
    assert.equal(g.leftPaddle.y, lastY);
    g.start('pvc');
    canvas.dispatch('touchstart', { changedTouches: [g.touch(3, 480, 100)] });
    assert.equal(g.touchDrag.left.id, 3, 'Either court half steers the player in PvC');
    assert.equal(g.touchDrag.right.id, null);
});

test('touch buttons support simultaneous players and independent pointer lifetimes', () => {
    const g = boot();
    g.start();
    const buttons = g.document.querySelectorAll('.touch-btn');
    const left = buttons.find(b => b.dataset.paddle === 'left' && b.dataset.direction === 'up');
    const right = buttons.find(b => b.dataset.paddle === 'right' && b.dataset.direction === 'down');
    const initial = g.leftPaddle.y;
    left.dispatch('pointerdown', { pointerId: 1 });
    right.dispatch('pointerdown', { pointerId: 2 });
    g.updatePlayerPaddles(0.1);
    assert.equal(g.leftPaddle.y, initial - 66);
    assert.equal(g.rightPaddle.y, initial + 66);
    left.dispatch('pointerdown', { pointerId: 3 });
    left.dispatch('pointerup', { pointerId: 1 });
    assert.ok(g.touchHeld.has('left-up'), 'Second finger must keep the button held');
    left.dispatch('pointercancel', { pointerId: 3 });
    right.dispatch('lostpointercapture', { pointerId: 2 });
    assert.equal(g.touchHeld.size, 0);
    assert.equal(left.classList.contains('is-pressed'), false);
    assert.equal(right.classList.contains('is-pressed'), false);
    left.dispatch('pointerdown', { pointerId: 4 });
    g.window.dispatch('pointerup', { pointerId: 4 });
    assert.equal(g.touchHeld.size, 0, 'Window release also clears a hold without capture');
});

test('pause freezes the match, respects button Space activation, and clears stale input', () => {
    const g = boot();
    g.start();
    g.key('keydown', 'KeyS');
    g.key('keydown', 'Space');
    assert.equal(g.state.phase, 'paused');
    assert.equal(g.keys.size, 0);
    assert.equal(g.get('touchControls').hidden, true);
    const position = [g.ball.x, g.ball.y, g.leftPaddle.y];
    g.frame(1000);
    g.frame(1100);
    assert.deepEqual([g.ball.x, g.ball.y, g.leftPaddle.y], position);
    const buttonSpace = g.key('keydown', 'Space', g.get('restartButton'));
    assert.equal(buttonSpace.defaultPrevented, false);
    assert.equal(g.state.phase, 'paused');
    g.key('keydown', 'Escape');
    assert.equal(g.state.phase, 'playing');
    g.key('keydown', 'KeyW');
    g.document.querySelectorAll('.touch-btn')[0].dispatch('pointerdown', { pointerId: 7 });
    g.get('gameCanvas').dispatch('touchstart', { changedTouches: [g.touch(8, 450, 100)] });
    g.window.dispatch('blur');
    assert.equal(g.keys.size, 0);
    assert.equal(g.touchHeld.size, 0);
    assert.equal(g.touchDrag.right.id, null);
    const stoppedY = g.leftPaddle.y;
    g.updatePlayerPaddles(0.1);
    assert.equal(g.leftPaddle.y, stoppedY);
    g.document.hidden = true;
    g.document.dispatch('visibilitychange');
    assert.equal(g.state.phase, 'paused');
    g.get('resumeButton').dispatch('click');
    assert.equal(g.state.phase, 'playing');
});

test('wall and paddle rebounds preserve direction, edge angles, and speed limit', () => {
    const g = boot();
    g.start();
    for (const bottom of [false, true]) {
        g.ball.y = bottom ? g.WORLD.height - g.ball.radius + 4 : g.ball.radius - 4;
        g.ball.vy = bottom ? 300 : -300;
        g.resolveWalls();
        assert.equal(g.ball.vy, bottom ? -300 : 300);
        assert.equal(g.ball.y, bottom ? g.WORLD.height - g.ball.radius - 4 : g.ball.radius + 4);
    }
    for (const side of ['left', 'right']) {
        const paddle = side === 'left' ? g.leftPaddle : g.rightPaddle;
        const sign = side === 'left' ? 1 : -1;
        for (const hit of [0, -0.9, 0.9]) {
            Object.assign(g.ball, {
                x: side === 'left' ? paddle.x + paddle.width + g.ball.radius - 1 : paddle.x - g.ball.radius + 1,
                y: paddle.y + paddle.height / 2 + hit * paddle.height / 2,
                vx: -sign * g.CONFIG.ball.maxSpeed, vy: 0
            });
            const rally = g.state.rally;
            g.resolvePaddle(paddle, side);
            assert.equal(Math.sign(g.ball.vx), sign);
            assert.equal(Math.sign(g.ball.vy), Math.sign(hit));
            assert.ok(Math.abs(Math.hypot(g.ball.vx, g.ball.vy) - g.CONFIG.ball.maxSpeed) < 1e-8);
            assert.equal(g.state.rally, rally + 1);
            const angle = Math.atan2(Math.abs(g.ball.vy), Math.abs(g.ball.vx));
            assert.ok(Math.abs(angle - Math.abs(hit) * g.CONFIG.ball.maxBounceAngle) < 1e-8);
            g.resolvePaddle(paddle, side);
            assert.equal(g.state.rally, rally + 1, 'A departing ball must not bounce twice');
        }
    }
});

test('goals end at five, update the winner, and rematch resets scores and serve state', () => {
    for (const winner of ['left', 'right']) {
        const g = boot();
        g.start('pvc');
        for (let point = 1; point <= 5; point++) {
            Object.assign(g.ball, {
                x: winner === 'left' ? g.WORLD.width + g.ball.radius + 1 : -g.ball.radius - 1,
                y: 300, vx: 0, vy: 0
            });
            g.state.serveTimer = 0;
            g.stepSimulation(g.CONFIG.loop.step);
            assert.equal(g.state.scores[winner], point);
            assert.equal(g.state.phase, point === 5 ? 'gameover' : 'playing');
        }
        assert.equal(g.state.winner, winner);
        assert.ok(g.get('gameOverOverlay').classList.contains('is-open'));
        assert.equal(g.get(winner === 'left' ? 'finalLeftScore' : 'finalRightScore').textContent, '5');
        g.get('rematchButton').dispatch('click');
        assert.equal(g.state.mode, 'pvc');
        assert.equal(g.state.phase, 'playing');
        assert.equal(g.state.scores.left + g.state.scores.right, 0);
        assert.equal(g.state.winner, null);
        assert.equal(g.state.serveTimer, g.CONFIG.match.serveDelay);
        assert.equal(g.ball.x, g.WORLD.width / 2);
        assert.equal(g.ball.y, g.WORLD.height / 2);
    }
});

test('fixed-step movement is consistent across refresh rates and caps long frame gaps', () => {
    for (const hz of [30, 60, 120, 144]) {
        const g = boot();
        g.start();
        g.leftPaddle.y = 0;
        g.key('keydown', 'KeyS');
        g.frame(1000);
        for (let frame = 1; frame <= hz / 2; frame++) g.frame(1000 + frame * 1000 / hz);
        assert.ok(Math.abs(g.leftPaddle.y - 330) <= g.CONFIG.paddle.playerSpeed * g.CONFIG.loop.step + 1e-6);
    }
    const g = boot();
    g.start();
    g.key('keydown', 'KeyS');
    g.frame(1000);
    const startY = g.leftPaddle.y;
    g.frame(61000);
    assert.ok(g.leftPaddle.y - startY <= g.CONFIG.paddle.playerSpeed * g.CONFIG.loop.maxFrame + 1e-6);
});
