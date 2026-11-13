const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the same classic scripts as the offline game without a browser or a build step.
const scripts = ['physics.js', 'difficulty.js', 'course.js'].map(file =>
    fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'));
const { RunnerPhysics: player, RunnerCourse: track, RunnerDifficulty: difficulty } = vm.runInNewContext(
    scripts.join('\n') + '\n;({ RunnerPhysics, RunnerCourse, RunnerDifficulty })');
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

test('500-point boundaries advance exactly once and speed and distance stay continuous', () => {
    const names = ['Easy', 'Normal', 'Moderate', 'Hard', 'Very Hard', 'Extreme'];
    const thresholds = [500, 1000, 1500, 2000, 2500, 3000, 3500];
    for (const [i, score] of thresholds.entries()) {
        assert.equal(difficulty.levelForScore(score - 1), i + 1);
        assert.equal(difficulty.levelForScore(score), i + 2);
        assert.equal(difficulty.levelForScore(score + 1), i + 2);
    }

    const run = difficulty.createRun();
    const course = track.createCourse(ground, 800, seeded(9));
    assert.equal(run.name, names[0]);
    const transitions = [];
    let liveCrossings = 0;
    let previousTargetSpeed = 0;
    let nextWarmupSample = 20;
    let warmupSpeed = run.speed;
    const dt = 1 / 60;
    while (run.score < 3550) {
        const previous = { distance: run.distance, speed: run.speed, level: run.level };
        const hazard = course.obstacles.find(o => o.x > 0 && o.x < 800);
        const previousX = hazard?.x;
        const changed = run.advance(dt);
        course.update(run);
        const moved = run.distance - previous.distance;
        assert.ok(moved > 0 && moved <= difficulty.tuning.maxSpeed * dt + 1e-7);
        assert.ok(run.speed >= previous.speed - 1e-8 && run.speed <= difficulty.tuning.maxSpeed);
        assert.ok(run.speed - previous.speed < 1, 'Speed stepped on a milestone');
        assert.equal(run.score, Math.floor(run.distance / 100));
        assert.equal(changed, previous.level !== run.level);
        if (run.elapsed >= nextWarmupSample && nextWarmupSample <= 80) {
            assert.equal(run.level, 1);
            assert.ok(run.speed > warmupSpeed, 'Elapsed time must still raise the opening pace');
            warmupSpeed = run.speed;
            nextWarmupSample += 20;
        }
        if (changed) {
            assert.equal(run.level, previous.level + 1);
            if (run.level <= names.length) assert.equal(run.name, names[run.level - 1]);
            assert.ok(run.speed > previousTargetSpeed, 'Milestones stopped increasing speed');
            previousTargetSpeed = run.speed;
            transitions.push(run.score);
        }
        if (hazard) {
            assert.ok(course.obstacles.includes(hazard));
            assert.ok(Math.abs(previousX - hazard.x - moved) < 1e-7, 'Live hazard shifted on the track');
            if (changed) liveCrossings++;
        }
    }
    assert.deepEqual(transitions, thresholds);
    assert.ok(liveCrossings > 0);
    // Many more milestones can be reached without overshooting the global cap.
    for (let second = 0; second < 7200; second++) {
        run.advance(1);
        assert.ok(run.speed <= difficulty.tuning.maxSpeed);
    }
    assert.ok(run.level > 100 && run.speed > previousTargetSpeed);
    const fresh = difficulty.createRun();
    assert.equal(fresh.distance, 0);
    assert.equal(fresh.score, 0);
    assert.equal(fresh.level, 1);
    assert.equal(fresh.speed, difficulty.tuning.baseSpeed);
    assert.equal(fresh.pressure, 0);
    const replay = track.createCourse(ground, 800, seeded(9));
    replay.update(fresh);
    assert.equal(replay.obstacles.length, 0);
});

test('held and released jump arcs stay the same through milestone crossings', () => {
    const hz = 120;
    for (const held of [false, true]) {
        const run = difficulty.createRun();
        const input = dino => { if (!held) player.releaseJump(dino); };
        const baseline = measureJump(hz, input);
        for (let milestone = 500; milestone <= 3500; milestone += 500) {
            while (run.score < milestone - 1) run.advance(1 / hz);
            const before = run.level;
            const sample = measureJump(hz, dino => {
                run.advance(1 / hz);
                input(dino);
            });
            assert.equal(run.level, before + 1, 'Expected to cross a milestone while airborne');
            assert.equal(sample.highest, baseline.highest);
            assert.equal(sample.time, baseline.time);
        }
    }
});

// Count adjacent plants cleared in one jump as one encounter. A mixed sequence
// needs separate inputs, so each of its hazards must satisfy the recovery budget.
function jumpGroup(obstacles) {
    const first = obstacles[0];
    const group = [first];
    if (first.kind === 'cactus') {
        for (const next of obstacles.slice(1)) {
            const last = group.at(-1);
            if (next.kind !== 'cactus' || next.trackX - last.trackX - last.width >= 24) break;
            group.push(next);
        }
    }
    return group;
}

function sampleCourse(run, count, random) {
    // Use the measured level and speed on a fresh stretch of track.
    const state = { ...run, distance: 0 };
    const course = track.createCourse(ground, 800, random);
    const groups = [];
    let end = -Infinity;
    while (groups.length < count) {
        course.update(state);
        let newObstacles = course.obstacles.filter(o => o.trackX > end);
        while (newObstacles.length) {
            const group = jumpGroup(newObstacles);
            groups.push(group);
            const last = group.at(-1);
            end = last.trackX + last.width;
            newObstacles = newObstacles.slice(group.length);
        }
        state.distance += 64;
        state.elapsed += 64 / state.speed;
    }
    return groups;
}

test('later levels shorten average distance and time and produce harder hazards within safe bounds', () => {
    const { gravity, jumpSpeed, standWidth } = player.tuning;
    const { baseSpeed, maxSpeed, minSpacing, maxEncountersPerSecond } = difficulty.tuning;
    const run = difficulty.createRun();
    const tiers = [];
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
        // Allow the warmup and each milestone transition to complete before sampling.
        while (run.elapsed < 80 || run.score < (level - 1) * 500 + 100) run.advance(1 / 30);
        assert.equal(run.level, level);
        const groups = sampleCourse(run, 1000, seeded(13));
        const first = groups[0][0];
        const last = groups.at(-1)[0];
        const meanDistance = (last.trackX - first.trackX) / (groups.length - 1);
        const birdLanes = groups.filter(g => g[0].kind === 'bird').map(g => ground - g[0].y - g[0].height);
        assert.deepEqual([...new Set(birdLanes)].sort((a, b) => a - b),
            level === 1 ? [8, 46, 86] : level < 5 ? [8, 38, 46, 86] : [8, 22, 38, 46, 86]);
        assert.equal(Math.max(...groups.map(g => g.length)), level < 4 ? 2 : 3);
        tiers.push({ meanDistance, interval: meanDistance / run.speed, birdCount: birdLanes.length,
            lanes: new Set(birdLanes), maxPlants: Math.max(...groups.map(g => g.length)) });

        let previousStart = -Infinity;
        let previousEnd = -Infinity;
        for (const group of groups) {
            const hazard = group[0];
            const end = group.at(-1).trackX + group.at(-1).width;
            assert.ok(hazard.trackX - previousEnd >= minSpacing - 1e-7, 'Gap fell below the configured floor');
            assert.ok((hazard.trackX - previousStart) / maxSpeed >= 1 / maxEncountersPerSecond - 1e-8);
            assert.ok((hazard.trackX - previousEnd - standWidth) / maxSpeed >= 2 * jumpSpeed / gravity + 0.17);
            previousEnd = end;
            previousStart = hazard.trackX;
            if (hazard.kind === 'bird' && ground - hazard.y - hazard.height >= player.tuning.duckHeight) continue;
            const clearance = Math.max(...group.map(o => ground - o.y)) + 6;
            const timeAbove = 2 * Math.sqrt(jumpSpeed ** 2 - 2 * gravity * clearance) / gravity;
            const timeAcross = (end - hazard.trackX + standWidth) / baseSpeed;
            assert.ok(timeAbove - timeAcross >= 0.08, 'Takeoff window too narrow at minimum speed');
        }

        if (level === 3 || level === 6) {
            // Always selecting the mixed-pattern branch forces its full queued sequence.
            const forced = sampleCourse(run, 6, () => 0);
            const actions = forced.map(g => g[0].kind === 'bird' ? 'duck' : 'jump');
            const cycle = level === 3 ? ['jump', 'duck'] : ['duck', 'jump', 'duck'];
            assert.deepEqual(Array.from(actions), Array.from({ length: 6 }, (_, i) => cycle[i % cycle.length]));
        }
    }
    for (let i = 1; i < tiers.length; i++) {
        assert.ok(tiers[i].meanDistance < tiers[i - 1].meanDistance);
        assert.ok(tiers[i].interval < tiers[i - 1].interval);
    }
    assert.ok(tiers.at(-1).birdCount > tiers[0].birdCount);
    assert.ok(tiers.at(-1).lanes.size > tiers[0].lanes.size);
    assert.equal(tiers[0].maxPlants, 2);
    assert.equal(tiers.at(-1).maxPlants, 3);
});

test('randomized courses stay playable through Level 8 at different display rates', () => {
    let jumps = 0;
    let ducks = 0;
    let triples = 0;
    for (const hz of rates) {
        for (const random of [() => 0, () => 1 - Number.EPSILON, seeded(3), seeded(29)]) {
            const run = difficulty.createRun();
            const course = track.createCourse(ground, 800, random);
            const dino = player.createDino(ground);
            let cleared = -Infinity;
            while (run.score < 3600) {
                const ahead = course.obstacles.filter(o => o.x + o.width > dino.x);
                if (ahead.length) {
                    const group = jumpGroup(ahead);
                    const first = group[0];
                    const last = group.at(-1);
                    const clearance = ground - first.y - first.height;
                    const passBelow = first.kind === 'bird' && clearance >= player.tuning.duckHeight;
                    player.setDuck(dino, passBelow && clearance < player.tuning.standHeight);
                    if (first.trackX > cleared) {
                        const center = (first.x + last.x + last.width) / 2;
                        const timeToCenter = (center - dino.x - dino.width / 2) / run.speed;
                        if (passBelow || timeToCenter <= 0.325) {
                            if (!passBelow) {
                                assert.ok(player.jump(dino), 'No time to land before the next jump');
                                jumps++;
                            } else if (dino.ducking) ducks++;
                            if (group.length === 3) triples++;
                            cleared = last.trackX;
                        }
                    }
                } else {
                    player.setDuck(dino, false);
                }
                const steps = Math.ceil(120 / hz);
                const dt = 1 / (steps * hz);
                for (let i = 0; i < steps; i++) {
                    run.advance(dt);
                    player.step(dino, dt, ground);
                    course.update(run);
                    for (const o of course.obstacles) {
                        assert.equal(player.hitsObstacle(dino, o), false, `Hit ${o.kind} at score ${run.score}, ${hz} Hz`);
                    }
                }
            }
            assert.equal(run.level, 8);
        }
    }
    assert.ok(jumps > 1000 && ducks > 100 && triples > 0);
});
