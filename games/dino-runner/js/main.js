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

    // Advance the original jump and speed values in fixed 60 Hz steps.
    const tickMs = 1000 / 60;
    const baseSpeed = 6;
    const maxSpeed = 14;
    const scoreKey = 'dinoRunnerHighScore';
    const dino = { x: 80, y: groundY - 72, width: 64, height: 72, vy: 0, grounded: true };
    const obstacles = [];
    let running = false;
    let speed = baseSpeed;
    let distance = 0;
    let score = 0;
    let highScore = readHighScore();
    let ticksPlayed = 0;
    let ticksUntilCactus = 0;
    let lastTime = 0;
    let accumulator = 0;

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

    function draw() {
        drawScene({ distance, dino, obstacles, preview: !startScreen.hidden });
    }

    function startRun() {
        if (running) return;
        running = true;
        speed = baseSpeed;
        distance = 0;
        score = 0;
        ticksPlayed = 0;
        ticksUntilCactus = 54 + Math.floor(Math.random() * 36);
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
        accumulator = 0;
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

    function step() {
        ticksPlayed++;
        if (ticksPlayed % 72 === 0) speed = Math.min(maxSpeed, speed + 0.15);
        distance += speed;
        const points = Math.floor(distance / 100);
        if (points !== score) {
            score = points;
            scoreEl.textContent = formatScore(score);
        }

        if (!dino.grounded) {
            dino.vy += 0.8;
            dino.y += dino.vy;
            if (dino.y >= groundY - dino.height) {
                dino.y = groundY - dino.height;
                dino.vy = 0;
                dino.grounded = true;
            }
        }

        ticksUntilCactus--;
        if (ticksUntilCactus === 0) {
            const height = 40 + Math.floor(Math.random() * 31);
            obstacles.push({ x: canvas.width + 20, y: groundY - height, width: height * 0.6, height });
            const difficulty = (speed - baseSpeed) / (maxSpeed - baseSpeed);
            // A jump takes 39 ticks. Even at top speed, leave time to land and jump again.
            ticksUntilCactus = Math.round(54 - 9 * difficulty + Math.random() * 15);
        }
        for (const cactus of obstacles) cactus.x -= speed;
        if (obstacles.length && obstacles[0].x + obstacles[0].width < 0) obstacles.shift();
        if (obstacles.some(hitsCactus)) endRun();
    }

    function frame(time) {
        accumulator += Math.min(100, Math.max(0, time - lastTime));
        lastTime = time;
        if (accumulator >= tickMs) {
            while (running && accumulator >= tickMs) {
                accumulator -= tickMs;
                step();
            }
            draw();
        }
        if (running) requestAnimationFrame(frame);
    }

    function jumpOrStart() {
        if (!running) {
            startRun();
        } else if (dino.grounded) {
            dino.vy = -16;
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
