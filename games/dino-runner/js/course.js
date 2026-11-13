const RunnerCourse = (() => {
    const birdWidth = 58;
    const birdHeight = 34;
    const reactionSeconds = 0.18;
    const takeoffTolerance = 0.08;
    const clearanceMargin = 6;
    const unlock = { lowBird: 14, duckBird: 24, cactusPair: 32, highBird: 42 };

    function createCourse(groundY, canvasWidth, random = Math.random) {
        const { baseSpeed, maxSpeed, minSpacing, maxEncountersPerSecond } = RunnerDifficulty.tuning;
        const { jumpSpeed, gravity, standWidth } = RunnerPhysics.tuning;
        const jumpSeconds = 2 * jumpSpeed / gravity;
        const recoveryGap = standWidth + maxSpeed * (jumpSeconds + reactionSeconds);
        const horizon = canvasWidth + 20;
        const obstacles = [];
        const pendingActions = [];
        let nextTrackX = horizon + baseSpeed * between(0.85, 1.35);

        function between(min, max) {
            return min + random() * (max - min);
        }

        function warmup(seconds, start) {
            return Math.max(0, Math.min((seconds - start) / 32, 1));
        }

        // The whole group must fit above the tallest plant, even at opening speed.
        function jumpableSpan(height) {
            const clearance = height + clearanceMargin;
            const clearSeconds = 2 * Math.sqrt(jumpSpeed ** 2 - 2 * gravity * clearance) / gravity;
            return baseSpeed * (clearSeconds - takeoffTolerance) - standWidth;
        }

        function place(kind, trackX, height, width, bottomClearance = 0) {
            obstacles.push({ kind, trackX, width, height, y: groundY - bottomClearance - height });
        }

        function placeCacti(trackX, count, run) {
            const heights = [];
            if (count === 1) {
                heights.push(Math.round(between(40, 70)));
            } else if (count === 2) {
                const tall = Math.round(between(40, 56));
                heights.push(tall, Math.round(between(30, tall)));
                if (run.level >= 2 && random() < run.pressure) heights.reverse();
            } else {
                // Short stalks keep even a three-cactus formation within a single jump.
                for (let i = 0; i < count; i++) heights.push(Math.round(between(26, 38)));
            }

            const widths = heights.map(height => Math.round(height * 0.6));
            const plantsWidth = widths.reduce((sum, width) => sum + width, 0);
            const spare = jumpableSpan(Math.max(...heights)) - plantsWidth;
            const maxGap = count > 1 ? Math.min(18, Math.floor(spare / (count - 1))) : 0;
            let x = trackX;
            for (let i = 0; i < count; i++) {
                if (i) x += Math.floor(between(6, maxGap));
                place('cactus', x, heights[i], widths[i]);
                x += widths[i];
            }
            return x - trackX;
        }

        function placeBird(trackX, run, mustDuck) {
            const lanes = mustDuck ? [46] : [8];
            if (!mustDuck && run.elapsed >= unlock.duckBird) lanes.push(46);
            if (!mustDuck && run.elapsed >= unlock.highBird) lanes.push(86);
            if (run.level >= 2) lanes.push(38);
            if (!mustDuck && run.level >= 5) lanes.push(22);
            place('bird', trackX, birdHeight, birdWidth, lanes[Math.floor(random() * lanes.length)]);
            return birdWidth;
        }

        function placeEncounter(trackX, run) {
            const { elapsed, level, pressure } = run;
            const birdChance = warmup(elapsed, unlock.lowBird) * (0.38 + 0.15 * pressure);
            const groupChance = warmup(elapsed, unlock.cactusPair) * (0.28 + 0.03 * pressure);
            const mixedChance = level >= 3 ? 0.16 * pressure : 0;
            const choice = random();

            // Queue actions, never coordinates. Each gets a fresh, independently safe
            // gap, and only enters the track when it reaches the spawn horizon.
            if (!pendingActions.length && choice < mixedChance) {
                const startsWithBird = level >= 4 && random() < 0.5;
                pendingActions.push(...(startsWithBird ? ['duck', 'ground'] : ['ground', 'duck']));
                if (level >= 6 && random() < pressure) pendingActions.push(pendingActions[0]);
            }
            if (pendingActions.length) {
                const action = pendingActions.shift();
                if (action === 'duck') return placeBird(trackX, run, true);
                return placeCacti(trackX, level >= 5 && random() < pressure ? 2 : 1, run);
            }
            if (choice < mixedChance + birdChance) return placeBird(trackX, run, false);
            if (choice < mixedChance + birdChance + groupChance) {
                const triple = level >= 4 && random() < pressure * 0.5;
                return placeCacti(trackX, triple ? 3 : 2, run);
            }
            return placeCacti(trackX, 1, run);
        }

        function nextInterval(width, run) {
            const warmup = (run.speed - baseSpeed) / (maxSpeed - baseSpeed);
            // Set both limits in track pixels. A rising speed must never undo a reduction
            // in distance, and an already placed group must remain safe at the speed cap.
            const minimum = Math.max(width + minSpacing, width + recoveryGap, maxSpeed / maxEncountersPerSecond);
            const extra = (1 - run.pressure) * between(100, 340) + (1 - warmup) * between(40, 160);
            return minimum + extra;
        }

        function update(run) {
            if (nextTrackX <= run.distance + horizon) {
                const width = placeEncounter(nextTrackX, run);
                nextTrackX += nextInterval(width, run);
            }
            for (const obstacle of obstacles) obstacle.x = obstacle.trackX - run.distance;
            while (obstacles.length && obstacles[0].x + obstacles[0].width < 0) obstacles.shift();
        }

        return { obstacles, update };
    }

    return { createCourse };
})();
