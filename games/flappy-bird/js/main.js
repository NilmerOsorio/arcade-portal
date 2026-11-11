// Flappy Bird runs its original physics at 60 ticks per second.
const tickDuration = 1000 / 60;

class FlappyBirdGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.gameState = 'start';
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.selectedBird = 'flame';
        this.bird = {
            x: 80, y: this.height / 2, width: 34, height: 24,
            velocity: 0, gravity: 0.5, jumpPower: -8, rotation: 0
        };
        this.pipes = [];
        this.pipeWidth = 60;
        this.pipeGap = 150;
        this.pipeSpawnRate = 90;
        this.pipeSpawnTimer = 0;
        this.pipeSpeed = 2.5;
        this.ground = { y: this.height - 80, height: 80, x: 0 };
        this.startOverlay = document.getElementById('startOverlay');
        this.characterOverlay = document.getElementById('characterOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.scoreHud = document.getElementById('scoreHud');
        this.currentScoreEl = document.getElementById('currentScore');
        this.finalScoreEl = document.getElementById('finalScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.options = [...document.querySelectorAll('.character-option')];
        this.init();
    }

    init() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.startGame());
        for (const id of ['chooseBirdBtn', 'changeBirdBtn']) {
            document.getElementById(id).addEventListener('click', () => {
                this.pipes = [];
                this.bird.y = this.height / 2;
                this.bird.rotation = 0;
                this.gameState = 'select';
                this.updateUI();
                this.draw();
                this.options.find(option => option.dataset.character === this.selectedBird).focus();
            });
        }
        document.getElementById('confirmBirdBtn').addEventListener('click', () => {
            this.gameState = 'start';
            this.updateUI();
            this.startBtn.focus();
        });
        for (const option of this.options) {
            this.drawPreview(option.querySelector('canvas'), option.dataset.character);
            option.addEventListener('click', () => this.selectBird(option));
        }
        this.selectBird(this.options.find(option => option.dataset.character === this.selectedBird));

        document.addEventListener('keydown', event => {
            if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
            // Let Space activate focused menu controls using normal keyboard behavior.
            if (this.gameState === 'select' ||
                (event.code === 'Space' && this.gameState !== 'playing' &&
                    event.target.closest?.('button, a'))) return;
            event.preventDefault();
            if (event.repeat) return;
            if (this.gameState === 'playing') this.flap();
            else if (this.gameState === 'start' || event.code === 'Space') this.startGame();
        });
        this.canvas.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            if (this.gameState === 'playing') this.flap();
        });
        this.updateUI();
    }

    drawPreview(canvas, skin) {
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        FlappyArt.drawBird(ctx, skin, 0, 0, canvas.width, canvas.height);
    }

    selectBird(option) {
        this.selectedBird = option.dataset.character;
        for (const choice of this.options) {
            const selected = choice === option;
            choice.classList.toggle('active', selected);
            choice.setAttribute('aria-pressed', String(selected));
        }
        this.drawPreview(document.getElementById('selectedBirdPreview'), this.selectedBird);
        document.getElementById('selectedBirdName').textContent = option.getAttribute('aria-label');
        this.draw();
    }

    startGame() {
        if (this.gameState === 'playing') return;
        this.gameState = 'playing';
        this.score = 0;
        this.bird.y = this.height / 2;
        this.ground.x = 0;
        this.pipes = [];
        this.pipeSpawnTimer = 0;
        this.flap();
        this.updateUI();
        this.canvas.focus({ preventScroll: true });
        this.lastFrameTime = performance.now();
        this.accumulator = 0;
        this.draw();
        requestAnimationFrame(time => this.gameLoop(time));
    }

    flap() {
        this.bird.velocity = this.bird.jumpPower;
        this.bird.rotation = -25;
    }

    gameLoop(time) {
        // Bound catch-up after a background tab resumes.
        this.accumulator += Math.min(100, Math.max(0, time - this.lastFrameTime));
        this.lastFrameTime = time;
        while (this.accumulator >= tickDuration && this.gameState === 'playing') {
            this.update();
            this.accumulator -= tickDuration;
        }
        this.draw();
        if (this.gameState === 'playing') requestAnimationFrame(next => this.gameLoop(next));
    }

    update() {
        this.bird.velocity += this.bird.gravity;
        this.bird.y += this.bird.velocity;
        if (this.bird.velocity < 0) {
            this.bird.rotation = Math.max(-25, this.bird.rotation - 2);
        } else {
            this.bird.rotation = Math.min(90, this.bird.rotation + 3);
        }
        this.ground.x += this.pipeSpeed;
        this.updatePipes();
        this.checkCollisions();
        if (this.gameState === 'playing') this.updateScore();
    }

    updatePipes() {
        // Spawn new pipes
        if (this.pipeSpawnTimer >= this.pipeSpawnRate) {
            this.spawnPipe();
            this.pipeSpawnTimer = 0;
        } else {
            this.pipeSpawnTimer++;
        }
        
        // Update existing pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= this.pipeSpeed;
            
            // Remove pipes that are off screen
            if (pipe.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }
    }
    
    spawnPipe() {
        const minGapY = 50;
        const maxGapY = this.height - this.pipeGap - this.ground.height - 50;
        const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
        
        // Top pipe
        this.pipes.push({
            x: this.width,
            y: 0,
            width: this.pipeWidth,
            height: gapY,
            type: 'top',
            scored: false
        });
        
        // Bottom pipe
        this.pipes.push({
            x: this.width,
            y: gapY + this.pipeGap,
            width: this.pipeWidth,
            height: this.height - gapY - this.pipeGap - this.ground.height,
            type: 'bottom',
            scored: false
        });
    }
    
    checkCollisions() {
        // Ground collision
        if (this.bird.y + this.bird.height >= this.ground.y) {
            this.gameOver();
            return;
        }
        
        // Ceiling collision
        if (this.bird.y <= 0) {
            this.gameOver();
            return;
        }
        
        // Pipe collisions
        for (let i = 0; i < this.pipes.length; i++) {
            const pipe = this.pipes[i];
            
            if (this.isColliding(this.bird, pipe)) {
                this.gameOver();
                return;
            }
        }
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    updateScore() {
        for (let i = 0; i < this.pipes.length; i += 2) {
            const topPipe = this.pipes[i];
            if (topPipe && topPipe.type === 'top' && !topPipe.scored) {
                // Check if bird has passed the pipe
                if (this.bird.x > topPipe.x + topPipe.width) {
                    topPipe.scored = true;
                    this.score++;
                    this.currentScoreEl.textContent = this.score;
                    // Mark bottom pipe as scored too
                    if (this.pipes[i + 1]) {
                        this.pipes[i + 1].scored = true;
                    }
                }
            }
        }
    }

    gameOver() {
        this.gameState = 'gameover';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
                localStorage.setItem('flappyBirdHighScore', String(this.score));
            } catch {
                // The session best still works when browser storage is unavailable.
            }
        }
        this.updateUI();
        this.restartBtn.focus({ preventScroll: true });
    }

    loadHighScore() {
        try {
            const saved = Number(localStorage.getItem('flappyBirdHighScore'));
            return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
        } catch {
            return 0;
        }
    }

    updateUI() {
        this.startOverlay.classList.toggle('hidden', this.gameState !== 'start');
        this.characterOverlay.classList.toggle('hidden', this.gameState !== 'select');
        this.gameOverOverlay.classList.toggle('hidden', this.gameState !== 'gameover');
        this.scoreHud.classList.toggle('hidden', this.gameState !== 'playing');
        this.currentScoreEl.textContent = this.score;
        this.finalScoreEl.textContent = this.score;
        this.bestScoreEl.textContent = this.highScore;
    }

    draw() {
        FlappyArt.drawBackground(this.ctx, this.width, this.ground.y);
        for (const pipe of this.pipes) FlappyArt.drawPipe(this.ctx, pipe);
        FlappyArt.drawGround(this.ctx, this.width, this.ground, this.ground.x);
        const bird = this.bird;
        const pose = bird.rotation < -10 ? 'up' : bird.rotation > 25 ? 'down' : 'level';
        FlappyArt.drawBird(this.ctx, this.selectedBird, bird.x, bird.y, bird.width, bird.height, pose);
    }
}

document.addEventListener('DOMContentLoaded', () => new FlappyBirdGame());
