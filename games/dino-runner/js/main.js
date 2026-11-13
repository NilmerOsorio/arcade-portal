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
    const duckBtn = document.getElementById('duckBtn');
    const statusText = document.getElementById('statusText');

    const scoreKey = 'dinoRunnerHighScore';
    const jumpInputs = new Set();
    const duckInputs = new Set();
    let dino = RunnerPhysics.createDino(groundY);
    let course = RunnerCourse.createCourse(groundY, canvas.width);
    let running = false;
    let elapsed = 0;
    let distance = 0;
    let score = 0;
    let highScore = readHighScore();
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

    function draw() {
        drawScene({ elapsed, distance, dino, obstacles: course.obstacles, preview: !startScreen.hidden });
    }

    function startRun() {
        if (running) return;
        running = true;
        elapsed = 0;
        distance = 0;
        score = 0;
        dino = RunnerPhysics.createDino(groundY);
        course = RunnerCourse.createCourse(groundY, canvas.width);
        duckBtn.disabled = false;

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
        const hadGameFocus = document.activeElement === canvas || document.activeElement === duckBtn;
        jumpInputs.clear();
        duckInputs.clear();
        duckBtn.disabled = true;
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
        if (hadGameFocus) restartBtn.focus({ preventScroll: true });
    }

    function step(dt) {
        elapsed += dt;
        distance = RunnerCourse.distanceAt(elapsed);
        const points = Math.floor(distance / 100);
        if (points !== score) {
            score = points;
            scoreEl.textContent = formatScore(score);
        }

        RunnerPhysics.step(dino, dt, groundY);
        course.update(elapsed, distance);
        for (const obstacle of course.obstacles) {
            if (RunnerPhysics.hitsObstacle(dino, obstacle)) {
                endRun();
                break;
            }
        }
    }

    function frame(time) {
        // Consume fractional frames too. Short steps keep collision checks reliable
        // on slow displays, and the limit avoids skipping the track after a tab sleeps.
        let remaining = Math.min(0.1, Math.max(0, (time - lastTime) / 1000));
        lastTime = time;
        while (running && remaining > 0) {
            const dt = Math.min(remaining, 1 / 120);
            step(dt);
            remaining -= dt;
        }
        draw();
        if (running) requestAnimationFrame(frame);
    }

    function pressJump(source) {
        if (!running) {
            startRun();
        } else {
            jumpInputs.add(source);
            RunnerPhysics.jump(dino);
        }
    }

    function pressDuck(source) {
        if (!running) return;
        duckInputs.add(source);
        RunnerPhysics.setDuck(dino, true);
    }

    // A keyboard key and a finger can hold the same action independently.
    function release(source) {
        if (jumpInputs.delete(source) && !jumpInputs.size) RunnerPhysics.releaseJump(dino);
        if (duckInputs.delete(source) && !duckInputs.size) RunnerPhysics.setDuck(dino, false);
    }

    startBtn.addEventListener('click', startRun);
    restartBtn.addEventListener('click', startRun);
    function bindHold(element, press) {
        element.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            element.setPointerCapture(event.pointerId);
            press(event.pointerId);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            element.addEventListener(type, event => release(event.pointerId));
        }
    }
    bindHold(canvas, pressJump);
    bindHold(duckBtn, pressDuck);
    document.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
        if (event.target.closest?.('a')) return;
        const duckButtonKey = event.target === duckBtn && (event.code === 'Space' || event.code === 'Enter');
        if (event.code === 'ArrowDown' || duckButtonKey) {
            if (!running) return;
            event.preventDefault();
            if (!event.repeat) pressDuck(event.code);
            return;
        }
        if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
        if (event.code === 'Space' && event.target.closest?.('button')) return;
        event.preventDefault();
        if (!event.repeat) pressJump(event.code);
    });
    document.addEventListener('keyup', event => release(event.code));
    window.addEventListener('blur', () => {
        for (const source of jumpInputs) release(source);
        for (const source of duckInputs) release(source);
    });

    statusText.textContent = 'Ready';
    highScoreEl.textContent = formatScore(highScore);
    draw();
}

initRunner();
