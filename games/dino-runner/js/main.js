const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScoreEl = document.getElementById('finalScore');
const finalHighScoreEl = document.getElementById('finalHighScore');

const GRAVITY = 0.8;
const JUMP_FORCE = -16;
const GROUND_HEIGHT = 80;

const dinoImage = new Image();
const obstacleImage = new Image();
const backgroundImage = new Image();

dinoImage.src = 'assets/images/dinosaur.png';
obstacleImage.src = 'assets/images/obstacle.png';
backgroundImage.src = 'assets/images/background.jpg';

let assetsLoaded = 0;
const totalAssets = 3;

function assetLoaded() {
    assetsLoaded += 1;
    if (assetsLoaded === totalAssets) {
        init();
    }
}

dinoImage.onload = assetLoaded;
obstacleImage.onload = assetLoaded;
backgroundImage.onload = assetLoaded;

dinoImage.onerror = assetLoaded;
obstacleImage.onerror = assetLoaded;
backgroundImage.onerror = assetLoaded;

let gameState = 'start'; // start, playing, gameover
let lastTime = 0;
let deltaTime = 0;

let score = 0;
let highScore = Number(localStorage.getItem('dinoRunnerHighScore')) || 0;
highScoreEl.textContent = highScore;

const BASE_GAME_SPEED = 6;
const MAX_GAME_SPEED = 14;
const INITIAL_OBSTACLE_INTERVAL = 900;
const MIN_OBSTACLE_INTERVAL = 550;
let gameSpeed = BASE_GAME_SPEED;
let speedIncreaseTimer = 0;

const dino = {
    x: 80,
    y: 0,
    width: 64,
    height: 72,
    vy: 0,
    grounded: false,
    frame: 0,
    frameTimer: 0,
    frameInterval: 90, // ms per frame for running animation
    frameCount: 2 // assume spritesheet has 2 frames for running cycle
};

const groundY = canvas.height - GROUND_HEIGHT;

// Try to detect frame layout if spritesheet - default to horizontal 2 frames
function getDinoFrameSource() {
    if (dinoImage.width > 0 && dinoImage.height > 0) {
        // If width is roughly 2x height or clearly wider, assume horizontal frames
        if (dinoImage.width >= dinoImage.height * 1.5) {
            const frameWidth = dinoImage.width / dino.frameCount;
            const sx = Math.floor(dino.frame % dino.frameCount) * frameWidth;
            return { sx, sy: 0, sw: frameWidth, sh: dinoImage.height };
        } else if (dinoImage.height >= dinoImage.width * 1.5) {
            const frameHeight = dinoImage.height / dino.frameCount;
            const sy = Math.floor(dino.frame % dino.frameCount) * frameHeight;
            return { sx: 0, sy, sw: dinoImage.width, sh: frameHeight };
        }
    }
    return { sx: 0, sy: 0, sw: dinoImage.width, sh: dinoImage.height };
}

const background = {
    x1: 0,
    x2: 0,
    width: canvas.width,
    height: canvas.height
};

background.x2 = canvas.width;

const obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = INITIAL_OBSTACLE_INTERVAL; // ms

function init() {
    resetGame();
    setupControls();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    dino.y = groundY - dino.height;
    dino.vy = 0;
    dino.grounded = true;
    
    obstacles.length = 0;
    obstacleTimer = 0;
    obstacleInterval = INITIAL_OBSTACLE_INTERVAL + Math.random() * 600;
    
    gameSpeed = BASE_GAME_SPEED;
    speedIncreaseTimer = 0;
    score = 0;
    scoreEl.textContent = Math.floor(score);
    
    background.x1 = 0;
    background.x2 = canvas.width;
    
    gameState = 'start';
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
}

function setupControls() {
    function jump() {
        if (gameState === 'start') {
            startGame();
            return;
        }
        if (gameState === 'playing' && dino.grounded) {
            dino.vy = JUMP_FORCE;
            dino.grounded = false;
        }
        if (gameState === 'gameover') {
            restartGame();
        }
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            jump();
        }
    });
    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        jump();
    }, { passive: false });
    
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        jump();
    });
    
    startBtn.addEventListener('click', () => {
        startGame();
    });
    
    restartBtn.addEventListener('click', () => {
        restartGame();
    });
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    lastTime = performance.now();
}

function restartGame() {
    resetGame();
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    lastTime = performance.now();
}

function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    update(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (gameState !== 'playing') return;
    
    // Update score based on distance (continuous regardless of jump state)
    score += gameSpeed * 0.01;
    scoreEl.textContent = Math.floor(score);
    
    // Progressive speed scaling - increase speed over time/score, applies continuously
    speedIncreaseTimer += dt;
    if (speedIncreaseTimer > 1200) {
        if (gameSpeed < MAX_GAME_SPEED) {
            gameSpeed += 0.15;
        }
        speedIncreaseTimer = 0;
        // Increase difficulty as speed ramps up - spawn obstacles more frequently
        if (obstacleInterval > MIN_OBSTACLE_INTERVAL) {
            obstacleInterval -= 5;
            if (obstacleInterval < MIN_OBSTACLE_INTERVAL) {
                obstacleInterval = MIN_OBSTACLE_INTERVAL;
            }
        }
    }
    
    // Dino physics
    if (!dino.grounded) {
        dino.vy += GRAVITY;
        dino.y += dino.vy;
    }
    
    // Ground collision
    if (dino.y + dino.height >= groundY) {
        dino.y = groundY - dino.height;
        dino.vy = 0;
        dino.grounded = true;
    }
    
    // Scrolling background parallax - speed applies continuously regardless of jump/fall
    const bgSpeed = gameSpeed * 0.4;
    background.x1 -= bgSpeed;
    background.x2 -= bgSpeed;
    
    if (background.x1 <= -canvas.width) {
        background.x1 = background.x2 + canvas.width;
    }
    if (background.x2 <= -canvas.width) {
        background.x2 = background.x1 + canvas.width;
    }
    
    // Obstacle spawning - frequency increases as game speed/difficulty ramps up
    obstacleTimer += dt;
    if (obstacleTimer >= obstacleInterval) {
        spawnObstacle();
        obstacleTimer = 0;
        // Dynamically adjust interval based on current game speed for progressive difficulty
        const speedFactor = Math.min((gameSpeed - BASE_GAME_SPEED) / (MAX_GAME_SPEED - BASE_GAME_SPEED), 1);
        obstacleInterval = (INITIAL_OBSTACLE_INTERVAL - speedFactor * 250) + Math.random() * 250 - Math.min(gameSpeed * 8, 300);
        if (obstacleInterval < MIN_OBSTACLE_INTERVAL) {
            obstacleInterval = MIN_OBSTACLE_INTERVAL;
        }
    }
    
    // Update obstacles - movement speed applies continuously regardless of jump state
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;
        
        // Remove off-screen obstacles
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            continue;
        }
        
        // Collision detection
        if (isColliding(dino, obstacles[i])) {
            gameOver();
            break;
        }
    }
}

function spawnObstacle() {
    const minHeight = 40;
    const maxHeight = 70;
    const height = minHeight + Math.random() * (maxHeight - minHeight);
    const width = height * 0.6;
    
    obstacles.push({
        x: canvas.width + 20,
        y: groundY - height,
        width: width,
        height: height
    });
}

function isColliding(rect1, rect2) {
    // Precise bounding box collision with small padding for pixel art
    const padding = 6;
    return (
        rect1.x + padding < rect2.x + rect2.width - padding &&
        rect1.x + rect1.width - padding > rect2.x + padding &&
        rect1.y + padding < rect2.y + rect2.height - padding &&
        rect1.y + rect1.height - padding > rect2.y + padding
    );
}

function gameOver() {
    gameState = 'gameover';
    
    const finalScore = Math.floor(score);
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('dinoRunnerHighScore', highScore.toString());
        highScoreEl.textContent = highScore;
    }
    
    finalScoreEl.textContent = finalScore;
    finalHighScoreEl.textContent = highScore;
    
    gameOverScreen.classList.remove('hidden');
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw scrolling background
    if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
        // Draw parallax background (tiled)
        ctx.drawImage(backgroundImage, background.x1, 0, canvas.width, canvas.height);
        ctx.drawImage(backgroundImage, background.x2, 0, canvas.width, canvas.height);
    } else {
        // Fallback gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw ground line
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, groundY, canvas.width, 4);
    
    // Draw obstacles
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obstacleImage.complete && obstacleImage.naturalWidth > 0) {
            ctx.drawImage(obstacleImage, obs.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    }
    
    // Draw dinosaur as static sprite (vertical position changes only on jump/fall)
    if (dinoImage.complete && dinoImage.naturalWidth > 0) {
        ctx.drawImage(
            dinoImage,
            0,
            0,
            dinoImage.naturalWidth,
            dinoImage.naturalHeight,
            dino.x,
            dino.y,
            dino.width,
            dino.height
        );
    } else {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
    }
}
