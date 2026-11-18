const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function findWinningLine(board) {
    return winningLines.find(([a, b, c]) =>
        board[a] !== '' && board[a] === board[b] && board[a] === board[c]
    );
}

function minimax(board, player, depth) {
    const line = findWinningLine(board);
    if (line) {
        // O prefers an earlier win and prolongs a forced loss.
        return board[line[0]] === 'O' ? 10 - depth : depth - 10;
    }
    if (!board.includes('')) return 0;

    const maximizing = player === 'O';
    const nextPlayer = maximizing ? 'X' : 'O';
    let bestScore = maximizing ? -Infinity : Infinity;

    for (let index = 0; index < board.length; index++) {
        if (board[index] !== '') continue;

        board[index] = player;
        const score = minimax(board, nextPlayer, depth + 1);
        board[index] = '';
        bestScore = maximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
    }
    return bestScore;
}

class TicTacToe {
    constructor() {
        this.gameMode = 'pvp';
        this.scores = { x: 0, o: 0, tie: 0 };
        this.computerTimer = null;

        this.modePvpBtn = document.getElementById('modePvp');
        this.modePvcBtn = document.getElementById('modePvc');
        this.statusBanner = document.getElementById('statusBanner');
        this.statusText = document.getElementById('statusText');
        this.cells = document.querySelectorAll('.cell');
        this.scoreXEl = document.getElementById('scoreX');
        this.scoreOEl = document.getElementById('scoreO');
        this.scoreTieEl = document.getElementById('scoreTie');
        this.scoreOLabel = document.getElementById('scoreOLabel');

        this.modePvpBtn.addEventListener('click', () => this.setGameMode('pvp'));
        this.modePvcBtn.addEventListener('click', () => this.setGameMode('pvc'));
        this.cells.forEach(cell => {
            cell.addEventListener('click', event => {
                const index = Number(event.currentTarget.dataset.cellIndex);
                if (this.gameActive && !this.isComputerTurn() && this.board[index] === '') {
                    this.playMove(index);
                }
            });
        });
        document.getElementById('resetRoundBtn').addEventListener('click', () => this.resetRound());
        document.getElementById('resetScoresBtn').addEventListener('click', () => this.resetScores());
        this.resetRound();
    }

    setGameMode(mode) {
        this.gameMode = mode;
        this.resetRound();
    }

    resetRound() {
        clearTimeout(this.computerTimer);
        this.computerTimer = null;
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.winningLine = undefined;
        this.updateDisplay();
    }

    resetScores() {
        this.scores = { x: 0, o: 0, tie: 0 };
        this.resetRound();
    }

    isComputerTurn() {
        return this.gameActive && this.gameMode === 'pvc' && this.currentPlayer === 'O';
    }

    playMove(index) {
        this.board[index] = this.currentPlayer;
        this.winningLine = findWinningLine(this.board);

        if (this.winningLine || !this.board.includes('')) {
            this.gameActive = false;
            const scoreKey = this.winningLine ? this.currentPlayer.toLowerCase() : 'tie';
            this.scores[scoreKey]++;
        } else {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        }
        this.updateDisplay();

        if (this.isComputerTurn()) {
            this.computerTimer = setTimeout(() => {
                this.computerTimer = null;
                if (this.isComputerTurn()) this.playMove(this.getComputerMove());
            }, 600);
        }
    }

    getComputerMove() {
        const board = this.board.slice();
        if (findWinningLine(board)) return -1;

        const bestMoves = [];
        let bestScore = -Infinity;
        for (let index = 0; index < board.length; index++) {
            if (board[index] !== '') continue;

            board[index] = 'O';
            const score = minimax(board, 'X', 1);
            board[index] = '';

            if (score > bestScore) {
                bestScore = score;
                bestMoves.length = 0;
            }
            if (score === bestScore) bestMoves.push(index);
        }
        if (bestMoves.length === 0) return -1;
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    updateDisplay() {
        const pvc = this.gameMode === 'pvc';
        const thinking = this.isComputerTurn();
        const tie = !this.gameActive && !this.winningLine;
        const playerName = pvc && this.currentPlayer === 'O' ? 'Computer' : `Player ${this.currentPlayer}`;

        this.modePvpBtn.classList.toggle('active', !pvc);
        this.modePvcBtn.classList.toggle('active', pvc);
        this.modePvpBtn.setAttribute('aria-pressed', String(!pvc));
        this.modePvcBtn.setAttribute('aria-pressed', String(pvc));
        this.scoreOLabel.textContent = pvc ? 'Computer' : 'Player O';
        this.scoreXEl.textContent = this.scores.x;
        this.scoreOEl.textContent = this.scores.o;
        this.scoreTieEl.textContent = this.scores.tie;

        this.statusBanner.dataset.player = tie ? 'tie' : this.currentPlayer.toLowerCase();
        this.statusBanner.classList.toggle('winner-x', Boolean(this.winningLine) && this.currentPlayer === 'X');
        this.statusBanner.classList.toggle('winner-o', Boolean(this.winningLine) && this.currentPlayer === 'O');
        this.statusBanner.classList.toggle('tie', tie);
        if (tie) {
            this.statusText.textContent = 'Round tied';
        } else if (this.winningLine) {
            this.statusText.textContent = `${playerName} wins!`;
        } else if (thinking) {
            this.statusText.textContent = 'Computer is thinking…';
        } else {
            this.statusText.textContent = `${playerName}’s turn`;
        }

        this.cells.forEach((cell, index) => {
            const mark = this.board[index];
            cell.textContent = mark;
            cell.disabled = !this.gameActive || thinking || mark !== '';
            cell.classList.toggle('x', mark === 'X');
            cell.classList.toggle('o', mark === 'O');
            cell.classList.toggle('winning', Boolean(this.winningLine?.includes(index)));
            const row = Math.floor(index / 3) + 1;
            const column = index % 3 + 1;
            cell.setAttribute('aria-label', `Row ${row}, column ${column}, ${mark || 'empty'}`);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TicTacToe();
});
