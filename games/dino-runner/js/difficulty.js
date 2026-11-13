const RunnerDifficulty = (() => {
    const tuning = Object.freeze({
        pixelsPerPoint: 100,
        pointsPerLevel: 500,
        baseSpeed: 360,
        warmupSpeed: 600,
        maxSpeed: 840,
        warmupSeconds: 80,
        transitionSeconds: 4,
        levelsToHalfBonus: 3,
        minSpacing: 775,              // Canvas pixels between independent encounters.
        maxEncountersPerSecond: 1.05
    });
    const names = ['Easy', 'Normal', 'Moderate', 'Hard', 'Very Hard', 'Extreme'];

    function levelForScore(score) {
        return 1 + Math.floor(score / tuning.pointsPerLevel);
    }

    function smoothstep(fraction) {
        const t = Math.min(1, Math.max(0, fraction));
        return t * t * (3 - 2 * t);
    }

    function createRun() {
        let transitionStart = 0;
        let previousPressure = 0;
        let targetPressure = 0;
        const run = {
            elapsed: 0, distance: 0, speed: tuning.baseSpeed,
            score: 0, level: 1, name: names[0], pressure: 0,
            advance
        };

        function advance(dt) {
            const previousSpeed = run.speed;
            run.elapsed += dt;
            const blend = smoothstep((run.elapsed - transitionStart) / tuning.transitionSeconds);
            run.pressure = previousPressure + (targetPressure - previousPressure) * blend;
            const warmup = smoothstep(run.elapsed / tuning.warmupSeconds);
            // Time and milestones each use a share of the same speed budget.
            run.speed = tuning.baseSpeed + (tuning.warmupSpeed - tuning.baseSpeed) * warmup
                + (tuning.maxSpeed - tuning.warmupSpeed) * run.pressure;
            run.distance += (previousSpeed + run.speed) * dt / 2;
            run.score = Math.floor(run.distance / tuning.pixelsPerPoint);

            const level = levelForScore(run.score);
            if (level === run.level) return false;
            run.level = level;
            run.name = names[Math.min(level, names.length) - 1];
            transitionStart = run.elapsed;
            previousPressure = run.pressure;
            const milestones = level - 1;
            targetPressure = milestones / (milestones + tuning.levelsToHalfBonus);
            return true;
        }
        return run;
    }

    return { tuning, levelForScore, createRun };
})();
