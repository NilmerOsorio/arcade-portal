const choices = ["rock", "paper", "scissors"];

const choiceEmojis = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️",
    unknown: "❔"
};

const playerScoreEl = document.getElementById("player-score");
const computerScoreEl = document.getElementById("computer-score");
const tieScoreEl = document.getElementById("tie-score");
const streakEl = document.getElementById("streak");
const resultTextEl = document.getElementById("result-text");
const playerMoveEl = document.getElementById("player-move");
const computerMoveEl = document.getElementById("computer-move");
const choiceBtns = document.querySelectorAll(".choice-btn");
const resetBtn = document.getElementById("reset-btn");

let playerScore = 0;
let computerScore = 0;
let tieScore = 0;
let winningStreak = 0;

function getComputerChoice() {
    const randomIndex = Math.floor(Math.random() * choices.length);
    return choices[randomIndex];
}

function determineWinner(playerChoice, computerChoice) {
    if (playerChoice === computerChoice) {
        return "tie";
    }

    if (
        (playerChoice === "rock" && computerChoice === "scissors") ||
        (playerChoice === "paper" && computerChoice === "rock") ||
        (playerChoice === "scissors" && computerChoice === "paper")
    ) {
        return "win";
    }

    return "lose";
}

function updateStreak(result) {
    if (result === "win") {
        winningStreak += 1;
    } else if (result === "lose") {
        winningStreak = 0;
    }
    // Ties do not reset the winning streak
    streakEl.textContent = winningStreak.toString();
}

function updateScores(result) {
    if (result === "win") {
        playerScore += 1;
        playerScoreEl.textContent = playerScore.toString();
    } else if (result === "lose") {
        computerScore += 1;
        computerScoreEl.textContent = computerScore.toString();
    } else if (result === "tie") {
        tieScore += 1;
        tieScoreEl.textContent = tieScore.toString();
    }
}

function updateResultText(result) {
    resultTextEl.classList.remove("win", "lose", "tie");

    if (result === "win") {
        resultTextEl.textContent = "You win! Great move!";
        resultTextEl.classList.add("win");
    } else if (result === "lose") {
        resultTextEl.textContent = "You lost this round. Try again!";
        resultTextEl.classList.add("lose");
    } else if (result === "tie") {
        resultTextEl.textContent = "It's a tie! Go again!";
        resultTextEl.classList.add("tie");
    }
}

function animateMove(element) {
    element.classList.remove("played");
    // Force reflow to restart animation
    void element.offsetWidth;
    element.classList.add("played");
}

function playRound(playerChoice) {
    const computerChoice = getComputerChoice();
    const result = determineWinner(playerChoice, computerChoice);

    playerMoveEl.textContent = choiceEmojis[playerChoice] || choiceEmojis.unknown;
    computerMoveEl.textContent = choiceEmojis[computerChoice] || choiceEmojis.unknown;

    animateMove(playerMoveEl);
    animateMove(computerMoveEl);

    updateScores(result);
    updateStreak(result);
    updateResultText(result);
}

function resetGame() {
    playerScore = 0;
    computerScore = 0;
    tieScore = 0;
    winningStreak = 0;

    playerScoreEl.textContent = "0";
    computerScoreEl.textContent = "0";
    tieScoreEl.textContent = "0";
    streakEl.textContent = "0";

    playerMoveEl.textContent = choiceEmojis.unknown;
    computerMoveEl.textContent = choiceEmojis.unknown;
    playerMoveEl.classList.remove("played");
    computerMoveEl.classList.remove("played");

    resultTextEl.classList.remove("win", "lose", "tie");
    resultTextEl.textContent = "Game reset. Choose your move to start!";
}

choiceBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const choice = btn.dataset.choice;
        if (choices.includes(choice)) {
            playRound(choice);
        }
    });
});

resetBtn.addEventListener("click", resetGame);
