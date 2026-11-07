// Flappy Bird Game - Modern Arcade Edition
// Built with HTML5 Canvas, CSS3 & Vanilla JavaScript
// Spec-Driven Development (SDD) with OpenCode AI Agent

class FlappyBirdGame {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game dimensions
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Game state
        this.gameState = 'start'; // 'start', 'playing', 'gameover'
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.selectedBird = 'flame'; // 'flame', 'cyber', 'penguin', 'emoji'
        
        // Bird properties
        this.bird = {
            x: 80,
            y: this.height / 2,
            width: 34,
            height: 24,
            velocity: 0,
            gravity: 0.5,
            jumpPower: -8,
            rotation: 0
        };
        
        // Pipes
        this.pipes = [];
        this.pipeWidth = 60;
        this.pipeGap = 150;
        this.pipeSpawnRate = 90; // frames
        this.pipeSpawnTimer = 0;
        this.pipeSpeed = 2.5;
        
        // Ground
        this.ground = {
            y: this.height - 80,
            height: 80,
            x: 0
        };
        
        // UI elements
        this.startOverlay = document.getElementById('startOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.scoreHud = document.getElementById('scoreHud');
        this.currentScoreEl = document.getElementById('currentScore');
        this.finalScoreEl = document.getElementById('finalScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        
        // Game loop
        this.animationId = null;
        this.frameCount = 0;
        
        this.init();
    }
    
    init() {
        // Event listeners
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        
        // Character selection
        const charOptions = document.querySelectorAll('.character-option');
        charOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Update active state
                charOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Update selected bird
                this.selectedBird = option.getAttribute('data-character');
            });
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                this.handleInput();
            }
        });
        
        // Mouse/touch controls on canvas
        this.canvas.addEventListener('click', () => {
            this.handleInput();
        });
        
        // Touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInput();
        }, { passive: false });
        
        // Initialize UI
        this.updateUI();
        
        // Start game loop for rendering (even in start state)
        this.gameLoop();
    }
    
    handleInput() {
        if (this.gameState === 'start') {
            this.startGame();
        } else if (this.gameState === 'playing') {
            this.flap();
        }
        // In gameover state, restart is handled by button
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.bird.y = this.height / 2;
        this.bird.velocity = 0;
        this.bird.rotation = 0;
        this.pipes = [];
        this.pipeSpawnTimer = 0;
        this.frameCount = 0;
        
        this.updateUI();
        this.flap();
    }
    
    restartGame() {
        this.startGame();
    }
    
    flap() {
        this.bird.velocity = this.bird.jumpPower;
        this.bird.rotation = -25; // Tilt up on flap
    }
    
    gameLoop() {
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        this.frameCount++;
        
        if (this.gameState === 'playing') {
            // Update bird physics
            this.bird.velocity += this.bird.gravity;
            this.bird.y += this.bird.velocity;
            
            // Update bird rotation based on velocity
            if (this.bird.velocity < 0) {
                this.bird.rotation = Math.max(-25, this.bird.rotation - 2);
            } else {
                this.bird.rotation = Math.min(90, this.bird.rotation + 3);
            }
            
            // Update pipes
            this.updatePipes();
            
            // Check collisions
            this.checkCollisions();
            
            // Update score
            this.updateScore();
        }
        
        // Update UI
        this.updateUI();
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
        
        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
        
        this.updateUI();
    }
    
    loadHighScore() {
        const saved = localStorage.getItem('flappyBirdHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    saveHighScore() {
        localStorage.setItem('flappyBirdHighScore', this.highScore.toString());
    }
    
    updateUI() {
        // Update score display
        this.currentScoreEl.textContent = this.score;
        
        // Show/hide overlays based on game state
        if (this.gameState === 'start') {
            this.startOverlay.classList.remove('hidden');
            this.gameOverOverlay.classList.add('hidden');
            this.scoreHud.style.display = 'none';
        } else if (this.gameState === 'playing') {
            this.startOverlay.classList.add('hidden');
            this.gameOverOverlay.classList.add('hidden');
            this.scoreHud.style.display = 'block';
        } else if (this.gameState === 'gameover') {
            this.startOverlay.classList.add('hidden');
            this.gameOverOverlay.classList.remove('hidden');
            this.scoreHud.style.display = 'none';
            
            // Update game over scores
            this.finalScoreEl.textContent = this.score;
            this.bestScoreEl.textContent = this.highScore;
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw background gradient (sky)
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height * 0.7);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#98D8E8');
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.width, this.height * 0.7);
        
        // Draw pipes
        this.drawPipes();
        
        // Draw ground
        this.drawGround();
        
        // Draw bird
        this.drawBird();
    }
    
    drawPipes() {
        for (let i = 0; i < this.pipes.length; i++) {
            const pipe = this.pipes[i];
            
            // Pipe gradient
            const pipeGradient = this.ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
            if (pipe.type === 'top') {
                pipeGradient.addColorStop(0, '#228B22');
                pipeGradient.addColorStop(0.5, '#32CD32');
                pipeGradient.addColorStop(1, '#228B22');
            } else {
                pipeGradient.addColorStop(0, '#228B22');
                pipeGradient.addColorStop(0.5, '#32CD32');
                pipeGradient.addColorStop(1, '#228B22');
            }
            
            this.ctx.fillStyle = pipeGradient;
            this.ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
            
            // Pipe border
            this.ctx.strokeStyle = '#006400';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height);
            
            // Pipe cap (for top pipes)
            if (pipe.type === 'top') {
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(pipe.x - 2, pipe.y + pipe.height - 20, pipe.width + 4, 20);
                this.ctx.strokeStyle = '#006400';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(pipe.x - 2, pipe.y + pipe.height - 20, pipe.width + 4, 20);
            } else {
                // Pipe cap for bottom pipes
                this.ctx.fillStyle = '#32CD32';
                this.ctx.fillRect(pipe.x - 2, pipe.y, pipe.width + 4, 20);
                this.ctx.strokeStyle = '#006400';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(pipe.x - 2, pipe.y, pipe.width + 4, 20);
            }
        }
    }
    
    drawGround() {
        // Ground
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.ground.y, this.width, this.ground.height);
        
        // Ground pattern
        this.ctx.fillStyle = '#654321';
        for (let i = 0; i < this.width; i += 20) {
            this.ctx.fillRect(i, this.ground.y, 10, this.ground.height);
        }
        
        // Grass top
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.ground.y, this.width, 10);
    }
    
    drawBird() {
        this.ctx.save();
        
        // Translate to bird center for rotation
        this.ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        this.ctx.rotate((this.bird.rotation * Math.PI) / 180);
        
        if (this.selectedBird === 'emoji') {
            // Emoji Sprite Bird - facing right (flipped horizontally)
            this.ctx.scale(-1, 1);
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🐦', 0, 0);
        } else if (this.selectedBird === 'flame') {
            // Crimson Flame Bird
            const flameGradient = this.ctx.createLinearGradient(-17, -12, 17, 12);
            flameGradient.addColorStop(0, '#FF4500');
            flameGradient.addColorStop(0.5, '#FFD700');
            flameGradient.addColorStop(1, '#FF6347');
            this.ctx.fillStyle = flameGradient;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird border
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.shadowColor = '#FF4500';
            this.ctx.shadowBlur = 10;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Bird eye
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(8, -3, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird eye white
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(9, -4, 1, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird beak
            this.ctx.fillStyle = '#FF6347';
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(22, -2);
            this.ctx.lineTo(22, 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#D2691E';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Bird wing with flame effect
            const wingGradient = this.ctx.createLinearGradient(-13, 0, -3, 4);
            wingGradient.addColorStop(0, '#FFD700');
            wingGradient.addColorStop(1, '#FF4500');
            this.ctx.fillStyle = wingGradient;
            this.ctx.beginPath();
            this.ctx.ellipse(-5, 2, 8, 4, -20 * Math.PI / 180, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FF8C00';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 8;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        } else if (this.selectedBird === 'cyber') {
            // Cyber Neon Bluejay
            const cyberGradient = this.ctx.createLinearGradient(-17, -12, 17, 12);
            cyberGradient.addColorStop(0, '#00FFFF');
            cyberGradient.addColorStop(1, '#FF00FF');
            this.ctx.fillStyle = cyberGradient;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird border with glow
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 15;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Bird eye
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(8, -3, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird eye with glow
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(9, -4, 1, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 5;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Bird beak
            this.ctx.fillStyle = '#FF00FF';
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(22, -2);
            this.ctx.lineTo(22, 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#8B00FF';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.shadowColor = '#FF00FF';
            this.ctx.shadowBlur = 8;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Bird wing
            const cyberWingGradient = this.ctx.createLinearGradient(-13, 0, -3, 4);
            cyberWingGradient.addColorStop(0, '#FF00FF');
            cyberWingGradient.addColorStop(1, '#00FFFF');
            this.ctx.fillStyle = cyberWingGradient;
            this.ctx.beginPath();
            this.ctx.ellipse(-5, 2, 8, 4, -20 * Math.PI / 180, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#8B00FF';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.shadowColor = '#FF00FF';
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        } else if (this.selectedBird === 'penguin') {
            // Arctic Penguin
            // Body (white belly, black back)
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 2, this.bird.width / 2, this.bird.height / 2 - 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Black back
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.ellipse(0, -2, this.bird.width / 2, this.bird.height / 2 - 6, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird border
            this.ctx.strokeStyle = '#87CEEB';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Bird eye
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(8, -3, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird eye white
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(9, -4, 1, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Orange beak
            this.ctx.fillStyle = '#FFA500';
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(20, -3);
            this.ctx.lineTo(20, 3);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#FF8C00';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Penguin flippers (wings)
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.ellipse(-6, 4, 6, 3, -30 * Math.PI / 180, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else {
            // Default bird (yellow)
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird border
            this.ctx.strokeStyle = '#FFA500';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Bird eye
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(8, -3, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird eye white
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(9, -4, 1, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Bird beak
            this.ctx.fillStyle = '#FF6347';
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(22, -2);
            this.ctx.lineTo(22, 2);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#D2691E';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            // Bird wing
            this.ctx.fillStyle = '#FFA500';
            this.ctx.beginPath();
            this.ctx.ellipse(-5, 2, 8, 4, -20 * Math.PI / 180, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FF8C00';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FlappyBirdGame();
});
