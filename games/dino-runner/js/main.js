function initRunner() {
    const canvas = document.getElementById('gameCanvas');
    const groundY = canvas.height - 72;
    const drawScene = createRunnerArt(canvas, groundY);
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const finalScoreEl = document.getElementById('finalScore');
    const finalHighScoreEl = document.getElementById('finalHighScore');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const statusText = document.getElementById('statusText');

    // Speeds are in canvas pixels per second. All timers use seconds of active play.
    const baseSpeed = 360;
    const maxSpeed = 840;
    const rampSeconds = 64;
    const acceleration = (maxSpeed - baseSpeed) / rampSeconds;
    const openingSpawnGap = 1.35;
    const minSpawnGap = 0.8; // One jump lasts 0.65 seconds, leaving time to land.
    const gravity = 2880;
    const jumpVelocity = -936;
    const scoreKey = 'dinoRunnerHighScore';
    const dino = { x: 80, y: groundY - 72, width: 64, height: 72, vy: 0, grounded: true };
    const obstacles = [];
    let running = false;
    let elapsed = 0;
    let distance = 0;
    let score = 0;
    let highScore = readHighScore();
    let nextCactusAt = 0;
    let lastTime = 0;

    function readHighScore() {
        try {
            const saved = Number(localStorage.getItem(scoreKey));
            return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
        } catch {
            return 0;
        }
    }

    function formatScore(value) {
        return String(value).padStart(5, '0');
    }

    // Distance under constant acceleration, followed by travel at the speed cap.
    function distanceAt(seconds) {
        const rampTime = Math.min(seconds, rampSeconds);
        const averageRampSpeed = baseSpeed + acceleration * rampTime / 2;
        return averageRampSpeed * rampTime + maxSpeed * (seconds - rampTime);
    }

    function spawnGap(seconds) {
        const progress = Math.min(seconds / rampSeconds, 1);
        const shortestGap = openingSpawnGap + (minSpawnGap - openingSpawnGap) * progress;
        return shortestGap + Math.random() * 0.2;
    }

    function draw() {
        drawScene({ distance, dino, obstacles, preview: !startScreen.hidden });
    }

    function startRun() {
        if (running) return;
        running = true;
        elapsed = 0;
        distance = 0;
        score = 0;
        nextCactusAt = spawnGap(0);
        obstacles.length = 0;
        dino.y = groundY - dino.height;
        dino.vy = 0;
        dino.grounded = true;

        startScreen.hidden = true;
        gameOverScreen.hidden = true;
        statusText.textContent = 'Running';
        scoreEl.textContent = formatScore(score);
        canvas.focus({ preventScroll: true });
        lastTime = performance.now();
        draw();
        requestAnimationFrame(frame);
    }

    function endRun() {
        running = false;
        highScore = Math.max(highScore, readHighScore());
        if (score > highScore) {
            highScore = score;
            try {
                localStorage.setItem(scoreKey, String(highScore));
            } catch {
                // Keep the session best when storage is unavailable.
            }
        }
        statusText.textContent = 'Game over';
        finalScoreEl.textContent = formatScore(score);
        finalHighScoreEl.textContent = highScoreEl.textContent = formatScore(highScore);
        gameOverScreen.hidden = false;
        if (document.activeElement === canvas) restartBtn.focus({ preventScroll: true });
    }

    function hitsCactus(cactus) {
        const inset = 6;
        return dino.x + inset < cactus.x + cactus.width - inset &&
            dino.x + dino.width - inset > cactus.x + inset &&
            dino.y + inset < cactus.y + cactus.height - inset &&
            dino.y + dino.height - inset > cactus.y + inset;
    }

    function step(dt) {
        elapsed += dt;
        distance = distanceAt(elapsed);
        const points = Math.floor(distance / 100);
        if (points !== score) {
            score = points;
            scoreEl.textContent = formatScore(score);
        }

        if (!dino.grounded) {
            dino.y += dino.vy * dt + gravity * dt * dt / 2;
            dino.vy += gravity * dt;
            if (dino.y >= groundY - dino.height) {
                dino.y = groundY - dino.height;
                dino.vy = 0;
                dino.grounded = true;
            }
        }

        if (elapsed >= nextCactusAt) {
            const height = 40 + Math.floor(Math.random() * 31);
            // Place the cactus on the track at its scheduled time, even between frames.
            const trackX = distanceAt(nextCactusAt) + canvas.width + 20;
            obstacles.push({ trackX, y: groundY - height, width: height * 0.6, height });
            nextCactusAt += spawnGap(nextCactusAt);
        }
        for (const cactus of obstacles) cactus.x = cactus.trackX - distance;
        if (obstacles.length && obstacles[0].x + obstacles[0].width < 0) obstacles.shift();
        if (obstacles.some(hitsCactus)) endRun();
    }

    function frame(time) {
        // Consume fractional frames too. Short steps keep collision checks reliable
        // on slow displays, and the limit avoids skipping the track after a tab sleeps.
        let remaining = Math.min(0.1, Math.max(0, (time - lastTime) / 1000));
        lastTime = time;
        while (running && remaining > 0) {
            const dt = Math.min(remaining, 1 / 60);
            step(dt);
            remaining -= dt;
        }
        draw();
        if (running) requestAnimationFrame(frame);
    }

    function jumpOrStart() {
        if (!running) {
            startRun();
        } else if (dino.grounded) {
            dino.vy = jumpVelocity;
            dino.grounded = false;
        }
    }

    startBtn.addEventListener('click', startRun);
    restartBtn.addEventListener('click', startRun);
    canvas.addEventListener('pointerdown', event => {
        if (event.isPrimary && event.button === 0) jumpOrStart();
    });
    document.addEventListener('keydown', event => {
        if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
        // Preserve navigation and let Space activate a focused button natively.
        if (event.target.closest?.('a') || (event.code === 'Space' && event.target.closest?.('button'))) return;
        event.preventDefault();
        if (!event.repeat) jumpOrStart();
    });

    statusText.textContent = 'Ready';
    highScoreEl.textContent = formatScore(highScore);
    draw();
}

initRunner();
