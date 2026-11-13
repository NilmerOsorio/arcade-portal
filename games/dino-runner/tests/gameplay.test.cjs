const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the same classic scripts as the offline game without a browser or a build step.
const scripts = ['physics.js', 'course.js'].map(file =>
    fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'));
const { RunnerPhysics: player, RunnerCourse: track } = vm.runInNewContext(
    scripts.join('\n') + '\n;({ RunnerPhysics, RunnerCourse })');
const ground = 288;
const rates = [30, 60, 120, 144];

function seeded(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
}

function measureJump(hz, action = () => {}) {
    const dino = player.createDino(ground);
    assert.ok(player.jump(dino));
    assert.equal(player.jump(dino), false);
    let highest = 0;
    for (let frame = 1; frame <= hz; frame++) {
        action(dino);
        player.step(dino, 1 / hz, ground);
        highest = Math.max(highest, ground - dino.y - dino.height);
        if (dino.grounded) {
            assert.equal(dino.y + dino.height, ground);
            return { time: frame / hz, highest, dino };
        }
    }
    assert.fail('The dinosaur never landed');
}

test('held, released and fast-fall jumps have predictable arcs and land before the next jump', () => {
    for (const hz of rates) {
        const full = measureJump(hz);
        assert.ok(Math.abs(full.time - 0.65) <= 1 / hz + 1e-8);
        assert.ok(Math.abs(full.highest - 152.1) < 0.5);
        assert.ok(player.jump(full.dino));

        const tap = measureJump(hz, dino => player.releaseJump(dino));
        assert.ok(tap.highest > 96 && tap.highest < 100);
        assert.ok(tap.time < full.time);
        const dive = measureJump(hz, dino => player.setDuck(dino, true));
        // The apex may fall between samples. Faster descent can lower the nearest sample.
        assert.ok(Math.abs(dive.highest - full.highest) < 0.5);
        assert.ok(dive.time < full.time && dive.dino.ducking);
        assert.equal(player.jump(dive.dino), false);
        player.setDuck(dive.dino, false);
        assert.equal(dive.dino.y + dive.dino.height, ground);
        assert.ok(player.jump(dive.dino));
    }
});

test('solid cactus and bird pixels collide, while transparent corners and duck clearance are safe', () => {
    const dino = player.createDino(ground);
    const cactus = { kind: 'cactus', x: dino.x + 22, y: ground - 60, width: 36, height: 60 };
    const bird = { kind: 'bird', x: dino.x + 32, y: ground - 46 - 34, width: 58, height: 34 };
    assert.ok(player.hitsObstacle(dino, cactus));
    assert.ok(player.hitsObstacle(dino, bird));
    for (const hazard of [cactus, bird]) {
        // Only the upper-left corner of the dinosaur's sprite rectangle overlaps.
        const graze = { ...hazard, x: dino.x - hazard.width + 4, y: dino.y - hazard.height + 4 };
        assert.equal(player.hitsObstacle(dino, graze), false);
    }
    player.setDuck(dino, true);
    assert.equal(player.hitsObstacle(dino, bird), false);
    assert.ok(player.hitsObstacle(dino, cactus));
});

test('active time controls continuous speed, with an independent opening state on replay', () => {
    let previous = track.speedAt(0);
    assert.equal(previous, 360);
    for (let s = 0; s <= 100; s += 0.25) {
        const speed = track.speedAt(s);
        const measured = (track.distanceAt(s + 0.001) - track.distanceAt(s)) / 0.001;
        assert.ok(speed >= previous && speed <= 840 && speed - previous < 3);
        assert.ok(Math.abs(measured - speed) < 0.01);
        previous = speed;
    }
    assert.equal(track.speedAt(80), 840);
    const played = track.createCourse(ground, 800, seeded(42));
    played.update(2, track.distanceAt(2));
    assert.ok(played.obstacles.length);
    const fresh = track.createCourse(ground, 800, seeded(42));
    fresh.update(0, track.distanceAt(0));
    assert.equal(fresh.obstacles.length, 0);
    fresh.update(2, track.distanceAt(2));
    assert.deepEqual(fresh.obstacles, played.obstacles);
});

test('encounters leave both a takeoff window and time to recover at the speed cap', () => {
    const { gravity, jumpSpeed, standWidth } = player.tuning;
    const fullJump = 2 * jumpSpeed / gravity;
    for (const random of [() => 0, () => 1 - Number.EPSILON, seeded(8), seeded(13)]) {
        const course = track.createCourse(ground, 800, random);
        let previousEnd = -Infinity;
        for (let frame = 0; frame < 150 * 30; frame++) {
            const t = frame / 30;
            course.update(t, track.distanceAt(t));
            // A pair is emitted together; each new encounter is still off the right edge.
            const group = course.obstacles.filter(o => o.trackX > previousEnd);
            if (!group.length) continue;
            const first = group[0];
            const last = group[group.length - 1];
            const end = last.trackX + last.width;
            const recovery = (first.trackX - previousEnd - standWidth) / track.speedAt(150);
            assert.ok(recovery >= fullJump + 0.17, 'Insufficient recovery at maximum speed');
            previousEnd = end;

            if (first.kind === 'bird' && ground - first.y - first.height >= 46) continue;
            const clearance = Math.max(...group.map(o => ground - o.y)) + 6;
            const timeAbove = 2 * Math.sqrt(jumpSpeed ** 2 - 2 * gravity * clearance) / gravity;
            const timeAcross = (end - first.trackX + standWidth) / track.speedAt(0);
            assert.ok(timeAbove - timeAcross >= 0.08, 'Takeoff window too narrow at minimum speed');
        }
    }
});

test('random courses can be played from rest through the cap with time to recover', () => {
    const lanes = new Set();
    const heights = new Set();
    let pairs = 0;
    let completed = 0;
    for (const hz of rates) {
        for (const random of [() => 0, () => 1 - Number.EPSILON, ...[1, 3, 17, 29].map(seeded)]) {
            const course = track.createCourse(ground, 800, random);
            const dino = player.createDino(ground);
            let lastTrackX = -Infinity;
            for (let frame = 1; frame <= hz * 110; frame++) {
                const now = (frame - 1) / hz;
                const upcoming = course.obstacles.filter(o => o.x + o.width > dino.x);
                const [first, second] = upcoming;
                if (first) {
                    // Treat nearby plants as one jump. Aim to pass their midpoint at the apex.
                    const pair = second && first.kind === 'cactus' && second.kind === 'cactus'
                        && second.x - (first.x + first.width) < 24;
                    const last = pair ? second : first;
                    const clearance = ground - first.y - first.height;
                    const shouldDuck = first.kind === 'bird' && clearance === 46;
                    player.setDuck(dino, shouldDuck);
                    if (first.trackX > lastTrackX) {
                        const center = (first.x + last.x + last.width) / 2;
                        const secondsToCenter = (center - dino.x - dino.width / 2) / track.speedAt(now);
                        const walkUnder = first.kind === 'bird' && clearance >= 46;
                        if (walkUnder || secondsToCenter <= 0.325) {
                            if (!walkUnder) {
                                assert.ok(player.jump(dino), 'No time to recover from the previous encounter');
                            }
                            lastTrackX = last.trackX;
                            if (first.kind === 'bird') lanes.add(clearance);
                            else heights.add(first.height);
                            if (pair) pairs++;
                            completed++;
                        }
                    }
                } else {
                    player.setDuck(dino, false);
                }

                // Read controls at display rate, check collisions at the game's physics cadence.
                const steps = Math.ceil(120 / hz);
                for (let i = 1; i <= steps; i++) {
                    const t = now + i / (steps * hz);
                    player.step(dino, 1 / (steps * hz), ground);
                    course.update(t, track.distanceAt(t));
                    for (const o of course.obstacles) {
                        assert.equal(player.hitsObstacle(dino, o), false, `Hit ${o.kind} at ${t}s, ${hz} Hz`);
                    }
                }
            }
        }
    }
    assert.deepEqual([...lanes].sort((a, b) => a - b), [8, 46, 86]);
    assert.ok(heights.size > 20 && pairs > 100 && completed > 1000);
});
