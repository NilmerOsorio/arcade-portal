// Modern Tic Tac Toe - PvP & PvC Game
// Vanilla JavaScript Implementation

class TicTacToe {
    constructor() {
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.gameMode = 'pvp'; // 'pvp' or 'pvc'
        this.scores = {
            x: 0,
            o: 0,
            tie: 0
        };
        
        this.winningCombinations = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
    }
    
    initializeElements() {
        // Mode buttons
        this.modePvpBtn = document.getElementById('modePvp');
        this.modePvcBtn = document.getElementById('modePvc');
        
        // Status
        this.statusBanner = document.getElementById('statusBanner');
        this.statusText = document.getElementById('statusText');
        
        // Board
        this.gameBoard = document.getElementById('gameBoard');
        this.cells = document.querySelectorAll('.cell');
        
        // Scoreboard
        this.scoreXEl = document.getElementById('scoreX');
        this.scoreOEl = document.getElementById('scoreO');
        this.scoreTieEl = document.getElementById('scoreTie');
        this.scoreOLabel = document.getElementById('scoreOLabel');
        
        // Controls
        this.resetRoundBtn = document.getElementById('resetRoundBtn');
        this.resetScoresBtn = document.getElementById('resetScoresBtn');
    }
    
    bindEvents() {
        // Mode selection
        this.modePvpBtn.addEventListener('click', () => this.setGameMode('pvp'));
        this.modePvcBtn.addEventListener('click', () => this.setGameMode('pvc'));
        
        // Cell clicks
        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });
        
        // Control buttons
        this.resetRoundBtn.addEventListener('click', () => this.resetRound());
        this.resetScoresBtn.addEventListener('click', () => this.resetScores());
    }
    
    setGameMode(mode) {
        this.gameMode = mode;
        
        // Update button states
        this.modePvpBtn.classList.toggle('active', mode === 'pvp');
        this.modePvcBtn.classList.toggle('active', mode === 'pvc');
        
        // Update score label
        if (mode === 'pvc') {
            this.scoreOLabel.textContent = 'Computer';
        } else {
            this.scoreOLabel.textContent = 'Player O';
        }
        
        // Reset game when mode changes
        this.resetRound();
    }
    
    handleCellClick(e) {
        const cell = e.target;
        const index = parseInt(cell.getAttribute('data-cell-index'));
        
        // Check if cell is already taken or game is not active
        if (this.board[index] !== '' || !this.gameActive) {
            return;
        }
        
        // Make player move
        this.makeMove(index, this.currentPlayer);
        
        // Check for win or tie
        if (this.checkWin()) {
            this.handleGameEnd('win');
            return;
        }
        
        if (this.checkTie()) {
            this.handleGameEnd('tie');
            return;
        }
        
        // Switch player
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this.updateDisplay();
        
        // If in PvC mode and it's computer's turn
        if (this.gameMode === 'pvc' && this.currentPlayer === 'O' && this.gameActive) {
            this.makeComputerMove();
        }
    }
    
    makeMove(index, player) {
        this.board[index] = player;
        const cell = this.cells[index];
        cell.textContent = player;
        cell.classList.add(player.toLowerCase());
        cell.disabled = true;
    }
    
    makeComputerMove() {
        // Disable all cells temporarily to prevent clicks during computer turn
        this.cells.forEach(cell => {
            cell.disabled = true;
        });
        
        // Show thinking state
        this.statusText.textContent = 'Computer is thinking...';
        this.statusBanner.className = 'status-banner';
        
        // Brief delay for "thinking" effect
        setTimeout(() => {
            if (!this.gameActive) {
                // Re-enable cells if game ended
                this.cells.forEach((cell, idx) => {
                    if (this.board[idx] === '') {
                        cell.disabled = false;
                    }
                });
                return;
            }
            
            const moveIndex = this.getComputerMove();
            
            if (moveIndex !== -1) {
                this.makeMove(moveIndex, 'O');
                
                // Check for win or tie
                if (this.checkWin()) {
                    this.handleGameEnd('win');
                    return;
                }
                
                if (this.checkTie()) {
                    this.handleGameEnd('tie');
                    return;
                }
                
                // Switch back to player
                this.currentPlayer = 'X';
                this.updateDisplay();
                
                // Re-enable empty cells
                this.cells.forEach((cell, idx) => {
                    if (this.board[idx] === '') {
                        cell.disabled = false;
                    }
                });
            } else {
                // If no move found, just switch back
                this.currentPlayer = 'X';
                this.updateDisplay();
                
                this.cells.forEach((cell, idx) => {
                    if (this.board[idx] === '') {
                        cell.disabled = false;
                    }
                });
            }
        }, 600); // 600ms thinking delay
    }
    
    getComputerMove() {
        // Intelligent AI: Try to win, then block, then center, then corners, then edges
        
        // 1. Try to win
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'O';
                if (this.checkWinForPlayer('O')) {
                    this.board[i] = '';
                    return i;
                }
                this.board[i] = '';
            }
        }
        
        // 2. Try to block player from winning
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = 'X';
                if (this.checkWinForPlayer('X')) {
                    this.board[i] = '';
                    return i;
                }
                this.board[i] = '';
            }
        }
        
        // 3. Take center if available
        if (this.board[4] === '') {
            return 4;
        }
        
        // 4. Take corners
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(i => this.board[i] === '');
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }
        
        // 5. Take edges
        const edges = [1, 3, 5, 7];
        const availableEdges = edges.filter(i => this.board[i] === '');
        if (availableEdges.length > 0) {
            return availableEdges[Math.floor(Math.random() * availableEdges.length)];
        }
        
        return -1;
    }
    
    checkWinForPlayer(player) {
        for (let i = 0; i < this.winningCombinations.length; i++) {
            const [a, b, c] = this.winningCombinations[i];
            if (this.board[a] === player && 
                this.board[b] === player && 
                this.board[c] === player) {
                return true;
            }
        }
        return false;
    }
    
    checkWin() {
        for (let i = 0; i < this.winningCombinations.length; i++) {
            const [a, b, c] = this.winningCombinations[i];
            if (this.board[a] !== '' && 
                this.board[a] === this.board[b] && 
                this.board[a] === this.board[c]) {
                // Highlight winning cells
                this.highlightWinningCells([a, b, c]);
                return true;
            }
        }
        return false;
    }
    
    highlightWinningCells(cells) {
        cells.forEach(index => {
            this.cells[index].classList.add('winning');
        });
    }
    
    checkTie() {
        // Check if board is full and no winner
        return this.board.every(cell => cell !== '') && !this.checkWin();
    }
    
    handleGameEnd(result) {
        this.gameActive = false;
        
        // Disable all cells
        this.cells.forEach(cell => {
            cell.disabled = true;
        });
        
        if (result === 'win') {
            const winner = this.currentPlayer === 'X' ? 'X' : (this.gameMode === 'pvc' ? 'Computer' : 'O');
            if (this.currentPlayer === 'X') {
                this.statusText.textContent = `🎉 Player X Wins! 🎉`;
                this.statusBanner.className = 'status-banner winner-x';
                this.scores.x++;
                this.scoreXEl.textContent = this.scores.x;
            } else {
                if (this.gameMode === 'pvc') {
                    this.statusText.textContent = `🤖 Computer Wins! 🤖`;
                    this.statusBanner.className = 'status-banner winner-o';
                    this.scores.o++;
                    this.scoreOEl.textContent = this.scores.o;
                } else {
                    this.statusText.textContent = `🎉 Player O Wins! 🎉`;
                    this.statusBanner.className = 'status-banner winner-o';
                    this.scores.o++;
                    this.scoreOEl.textContent = this.scores.o;
                }
            }
        } else if (result === 'tie') {
            this.statusText.textContent = `🤝 It's a Tie! 🤝`;
            this.statusBanner.className = 'status-banner tie';
            this.scores.tie++;
            this.scoreTieEl.textContent = this.scores.tie;
        }
    }
    
    updateDisplay() {
        if (!this.gameActive) {
            return;
        }
        
        if (this.gameMode === 'pvc' && this.currentPlayer === 'O') {
            this.statusText.textContent = "Computer's Turn";
            this.statusBanner.className = 'status-banner';
        } else {
            this.statusText.textContent = `Player ${this.currentPlayer}'s Turn`;
            this.statusBanner.className = 'status-banner';
        }
        
        // Enable cells that are empty
        this.cells.forEach((cell, index) => {
            if (this.board[index] === '' && this.gameActive) {
                cell.disabled = false;
            } else if (this.board[index] !== '') {
                cell.disabled = true;
            }
        });
    }
    
    resetRound() {
        this.board = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
        
        // Clear cells
        this.cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'winning');
            cell.disabled = false;
        });
        
        // Reset status
        if (this.gameMode === 'pvc') {
            this.statusText.textContent = "Player X's Turn";
        } else {
            this.statusText.textContent = "Player X's Turn";
        }
        this.statusBanner.className = 'status-banner';
    }
    
    resetScores() {
        this.scores = {
            x: 0,
            o: 0,
            tie: 0
        };
        this.scoreXEl.textContent = '0';
        this.scoreOEl.textContent = '0';
        this.scoreTieEl.textContent = '0';
        this.resetRound();
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TicTacToe();
});
