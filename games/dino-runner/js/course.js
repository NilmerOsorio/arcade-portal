const RunnerCourse = (() => {
    const baseSpeed = 360;
    const maxSpeed = 840;
    const rampSeconds = 80;
    const birdWidth = 58;
    const birdHeight = 34;
    const recoverySeconds = 0.18;
    const takeoffTolerance = 0.08;
    const clearanceMargin = 6;
    const unlock = { lowBird: 14, duckBird: 24, cactusPair: 32, highBird: 42 };

    function speedAt(seconds) {
        const t = Math.min(seconds / rampSeconds, 1);
        return baseSpeed + (maxSpeed - baseSpeed) * t * t * (3 - 2 * t);
    }

    // Integrate the smoothstep ramp exactly, including travel after the speed cap.
    function distanceAt(seconds) {
        const rampTime = Math.min(seconds, rampSeconds);
        const t = rampTime / rampSeconds;
        const rampDistance = rampTime * (baseSpeed + (maxSpeed - baseSpeed) * t * t * (1 - t / 2));
        return rampDistance + (seconds - rampTime) * maxSpeed;
    }

    function createCourse(groundY, canvasWidth, random = Math.random) {
        const { jumpSpeed, gravity, standWidth } = RunnerPhysics.tuning;
        const jumpSeconds = 2 * jumpSpeed / gravity;
        const horizon = canvasWidth + 20;
        const obstacles = [];
        let nextTrackX = horizon + baseSpeed * between(0.85, 1.35);

        function between(min, max) {
            return min + random() * (max - min);
        }

        // Budget the entire bounding rectangle of both plants at the slowest speed.
        // This is stricter than their actual hitboxes and leaves a takeoff timing window.
        function jumpableSpan(height) {
            const clearance = height + clearanceMargin;
            const clearSeconds = 2 * Math.sqrt(jumpSpeed ** 2 - 2 * gravity * clearance) / gravity;
            return baseSpeed * (clearSeconds - takeoffTolerance) - standWidth;
        }

        function place(kind, trackX, height, width, bottomClearance = 0) {
            obstacles.push({ kind, trackX, width, height, y: groundY - bottomClearance - height });
        }

        function placeCactus(trackX, height) {
            const width = Math.round(height * 0.6);
            place('cactus', trackX, height, width);
            return width;
        }

        function placeEncounter(trackX, seconds) {
            const choice = random();
            const birdChance = 0.38 * Math.max(0, Math.min((seconds - unlock.lowBird) / 32, 1));
            const pairChance = 0.28 * Math.max(0, Math.min((seconds - unlock.cactusPair) / 32, 1));
            if (choice < birdChance) {
                const lanes = seconds < unlock.duckBird ? [8] : seconds < unlock.highBird ? [8, 46] : [8, 46, 86];
                const clearance = lanes[Math.floor(random() * lanes.length)];
                place('bird', trackX, birdHeight, birdWidth, clearance);
                return birdWidth;
            }
            if (choice < birdChance + pairChance) {
                const height = Math.round(between(40, 56));
                const firstWidth = placeCactus(trackX, height);
                const secondHeight = Math.round(between(30, height));
                const secondWidth = Math.round(secondHeight * 0.6);
                const availableGap = jumpableSpan(height) - firstWidth - secondWidth;
                const gap = Math.floor(between(6, Math.min(18, availableGap)));
                return firstWidth + gap + placeCactus(trackX + firstWidth + gap, secondHeight);
            }
            return placeCactus(trackX, Math.round(between(40, 70)));
        }

        function nextGap(speed) {
            const progress = (speed - baseSpeed) / (maxSpeed - baseSpeed);
            // Even if the world reaches its cap before the next encounter, the dinosaur
            // can finish one full jump and has a reaction reserve before the next overlap.
            const safeDistance = standWidth + maxSpeed * (jumpSeconds + recoverySeconds);
            const minSeconds = safeDistance / speed + (1 - progress) * 0.25;
            const maxSeconds = minSeconds + 0.65 - progress * 0.37;
            return speed * between(minSeconds, maxSeconds);
        }

        function update(elapsed, distance) {
            if (nextTrackX <= distance + horizon) {
                const width = placeEncounter(nextTrackX, elapsed);
                nextTrackX += width + nextGap(speedAt(elapsed));
            }
            for (const obstacle of obstacles) obstacle.x = obstacle.trackX - distance;
            while (obstacles.length && obstacles[0].x + obstacles[0].width < 0) obstacles.shift();
        }

        return { obstacles, update };
    }

    return { distanceAt, speedAt, createCourse };
})();
