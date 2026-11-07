// Question Bank - From questions.md specification
const questions = [
    {
        id: 1,
        questionText: "What is the largest desert in the world?",
        options: [
            { letter: "A", text: "Sahara Desert" },
            { letter: "B", text: "Arabian Desert" },
            { letter: "C", text: "Antarctic Desert" },
            { letter: "D", text: "Gobi Desert" }
        ],
        correctAnswer: "C",
        correctAnswerText: "C) Antarctic Desert",
        explanation: "Antarctica is the largest desert on Earth because it receives very little precipitation. Deserts can be cold or hot."
    },
    {
        id: 2,
        questionText: "Which chemical element has the symbol Au?",
        options: [
            { letter: "A", text: "Silver" },
            { letter: "B", text: "Gold" },
            { letter: "C", text: "Aluminium" },
            { letter: "D", text: "Copper" }
        ],
        correctAnswer: "B",
        correctAnswerText: "B) Gold",
        explanation: "The symbol Au comes from the Latin word aurum, meaning gold."
    },
    {
        id: 3,
        questionText: "In which year did the Berlin Wall fall?",
        options: [
            { letter: "A", text: "1975" },
            { letter: "B", text: "1985" },
            { letter: "C", text: "1989" },
            { letter: "D", text: "1991" }
        ],
        correctAnswer: "C",
        correctAnswerText: "C) 1989",
        explanation: "The Berlin Wall opened on November 9, 1989, becoming a major symbol of the end of the Cold War."
    },
    {
        id: 4,
        questionText: "Which planet is best known for its prominent ring system?",
        options: [
            { letter: "A", text: "Jupiter" },
            { letter: "B", text: "Neptune" },
            { letter: "C", text: "Uranus" },
            { letter: "D", text: "Saturn" }
        ],
        correctAnswer: "D",
        correctAnswerText: "D) Saturn",
        explanation: "Saturn's rings consist mainly of ice particles, along with rocky debris and dust. Other giant planets also have rings, but Saturn's are the most visible."
    },
    {
        id: 5,
        questionText: "What is the largest organ of the human body?",
        options: [
            { letter: "A", text: "Liver" },
            { letter: "B", text: "Skin" },
            { letter: "C", text: "Brain" },
            { letter: "D", text: "Lungs" }
        ],
        correctAnswer: "B",
        correctAnswerText: "B) Skin",
        explanation: "The skin protects the body, helps regulate temperature, and allows us to sense our surroundings."
    },
    {
        id: 6,
        questionText: "Who invented the World Wide Web?",
        options: [
            { letter: "A", text: "Bill Gates" },
            { letter: "B", text: "Steve Jobs" },
            { letter: "C", text: "Tim Berners-Lee" },
            { letter: "D", text: "Alan Turing" }
        ],
        correctAnswer: "C",
        correctAnswerText: "C) Tim Berners-Lee",
        explanation: "Tim Berners-Lee invented the World Wide Web in 1989 while working at CERN. It made it possible to access and navigate linked information through web pages."
    },
    {
        id: 7,
        questionText: "Which country is commonly recognized as having the most lakes?",
        options: [
            { letter: "A", text: "Canada" },
            { letter: "B", text: "Russia" },
            { letter: "C", text: "Brazil" },
            { letter: "D", text: "Finland" }
        ],
        correctAnswer: "A",
        correctAnswerText: "A) Canada",
        explanation: "Canada has an enormous number of natural lakes, many formed by glaciers. Exact counts depend on the minimum size used to define a lake."
    },
    {
        id: 8,
        questionText: "Which gas makes up the largest percentage of Earth's atmosphere?",
        options: [
            { letter: "A", text: "Oxygen" },
            { letter: "B", text: "Carbon dioxide" },
            { letter: "C", text: "Hydrogen" },
            { letter: "D", text: "Nitrogen" }
        ],
        correctAnswer: "D",
        correctAnswerText: "D) Nitrogen",
        explanation: "Nitrogen makes up approximately 78% of Earth's dry atmosphere, while oxygen accounts for about 21%."
    },
    {
        id: 9,
        questionText: "Which part of the brain is primarily responsible for balance and coordination?",
        options: [
            { letter: "A", text: "Cerebellum" },
            { letter: "B", text: "Hypothalamus" },
            { letter: "C", text: "Hippocampus" },
            { letter: "D", text: "Medulla oblongata" }
        ],
        correctAnswer: "A",
        correctAnswerText: "A) Cerebellum",
        explanation: "The cerebellum helps coordinate movement, maintain balance, and refine motor skills."
    },
    {
        id: 10,
        questionText: "Which subatomic particle has a negative electric charge?",
        options: [
            { letter: "A", text: "Proton" },
            { letter: "B", text: "Neutron" },
            { letter: "C", text: "Electron" },
            { letter: "D", text: "Nucleus" }
        ],
        correctAnswer: "C",
        correctAnswerText: "C) Electron",
        explanation: "Electrons carry a negative charge, protons carry a positive charge, and neutrons have no electric charge."
    }
];

// Quiz State
let currentQuestionIndex = 0;
let userAnswers = [];
let isAnswered = false;

// DOM Elements
const quizView = document.getElementById('quizView');
const dashboardView = document.getElementById('dashboardView');

const currentQuestionNumEl = document.getElementById('currentQuestionNum');
const totalQuestionsEl = document.getElementById('totalQuestions');
const progressBarEl = document.getElementById('progressBar');
const questionTextEl = document.getElementById('questionText');
const optionsContainerEl = document.getElementById('optionsContainer');
const nextBtn = document.getElementById('nextBtn');

// Dashboard Elements
const accuracyPercentageEl = document.getElementById('accuracyPercentage');
const correctCountEl = document.getElementById('correctCount');
const wrongCountEl = document.getElementById('wrongCount');
const breakdownContainerEl = document.getElementById('breakdownContainer');
const restartBtn = document.getElementById('restartBtn');

// Audio Elements
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioStatusEl = document.getElementById('audioStatus');
const backgroundMusic = document.getElementById('backgroundMusic');
let isMusicPlaying = false;

// Initialize Quiz
function initQuiz() {
    totalQuestionsEl.textContent = questions.length;
    currentQuestionIndex = 0;
    userAnswers = [];
    isAnswered = false;
    
    quizView.style.display = 'block';
    dashboardView.style.display = 'none';
    
    loadQuestion();
}

// Load Current Question
function loadQuestion() {
    const question = questions[currentQuestionIndex];
    isAnswered = false;
    
    // Update progress
    currentQuestionNumEl.textContent = currentQuestionIndex + 1;
    const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBarEl.style.width = progressPercent + '%';
    
    // Update question text
    questionTextEl.textContent = question.questionText;
    
    // Clear options container
    optionsContainerEl.innerHTML = '';
    
    // Create option buttons
    question.options.forEach(option => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'option-btn';
        optionBtn.innerHTML = `
            <span class="option-letter">${option.letter})</span>
            <span>${option.text}</span>
        `;
        optionBtn.dataset.letter = option.letter;
        optionBtn.onclick = () => selectOption(optionBtn, option.letter);
        optionsContainerEl.appendChild(optionBtn);
    });
    
    // Disable next button
    nextBtn.disabled = true;
    nextBtn.textContent = currentQuestionIndex === questions.length - 1 ? 'See Results' : 'Next Question';
}

// Select Option
function selectOption(selectedBtn, selectedLetter) {
    if (isAnswered) return;
    
    isAnswered = true;
    const question = questions[currentQuestionIndex];
    const isCorrect = selectedLetter === question.correctAnswer;
    
    // Store user answer
    userAnswers.push({
        questionId: question.id,
        questionText: question.questionText,
        userAnswer: selectedLetter,
        userAnswerText: `${selectedLetter}) ${question.options.find(o => o.letter === selectedLetter).text}`,
        correctAnswer: question.correctAnswer,
        correctAnswerText: question.correctAnswerText,
        isCorrect: isCorrect,
        explanation: question.explanation
    });
    
    // Disable all option buttons
    const allOptionBtns = optionsContainerEl.querySelectorAll('.option-btn');
    allOptionBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.remove('selected');
    });
    
    // Mark selected option
    selectedBtn.classList.add('selected');
    
    // Show correct/incorrect feedback
    if (isCorrect) {
        selectedBtn.classList.add('correct');
    } else {
        selectedBtn.classList.add('incorrect');
        // Highlight correct answer
        allOptionBtns.forEach(btn => {
            if (btn.dataset.letter === question.correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }
    
    // Enable next button
    nextBtn.disabled = false;
}

// Next Question
function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        loadQuestion();
        // Scroll to top of quiz card
        document.querySelector('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        showDashboard();
    }
}

// Show Dashboard
function showDashboard() {
    quizView.style.display = 'none';
    dashboardView.style.display = 'block';
    
    // Calculate results
    const totalQuestions = questions.length;
    const correctAnswers = userAnswers.filter(ans => ans.isCorrect).length;
    const wrongAnswers = totalQuestions - correctAnswers;
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Update dashboard
    accuracyPercentageEl.textContent = accuracy + '%';
    correctCountEl.textContent = correctAnswers;
    wrongCountEl.textContent = wrongAnswers;
    
    // Update accuracy circle
    const accuracyCircle = document.querySelector('.accuracy-circle');
    accuracyCircle.style.setProperty('--percentage', (accuracy * 3.6) + 'deg');
    
    // Render breakdown
    breakdownContainerEl.innerHTML = '';
    userAnswers.forEach((answer, index) => {
        const breakdownItem = document.createElement('div');
        breakdownItem.className = `breakdown-item ${answer.isCorrect ? 'correct' : 'incorrect'}`;
        
        breakdownItem.innerHTML = `
            <div class="breakdown-question">
                Q${index + 1}. ${answer.questionText}
            </div>
            <div class="breakdown-details">
                <div class="breakdown-detail">
                    Your answer: <strong class="${answer.isCorrect ? 'breakdown-correct' : 'breakdown-wrong'}">${answer.userAnswerText}</strong>
                </div>
                ${!answer.isCorrect ? `
                    <div class="breakdown-detail">
                        Correct answer: <strong class="breakdown-correct">${answer.correctAnswerText}</strong>
                    </div>
                ` : ''}
                <div class="breakdown-detail">
                    <em>${answer.explanation}</em>
                </div>
            </div>
        `;
        
        breakdownContainerEl.appendChild(breakdownItem);
    });
    
    // Scroll to top
    document.querySelector('.dashboard-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Restart Quiz
function restartQuiz() {
    initQuiz();
    document.querySelector('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Audio Controls
function toggleAudio() {
    if (isMusicPlaying) {
        backgroundMusic.pause();
        audioStatusEl.textContent = 'Play / Pause Music';
        isMusicPlaying = false;
        audioToggleBtn.style.opacity = '0.8';
        console.log('Background music paused');
    } else {
        // Try to play music - local audio file
        backgroundMusic.play().then(() => {
            audioStatusEl.textContent = 'Play / Pause Music';
            isMusicPlaying = true;
            audioToggleBtn.style.opacity = '1';
            console.log('Background music started playing from local asset: assets/bensound-hey.mp3');
        }).catch(err => {
            console.error('Audio play failed:', err);
            console.log('Audio error details:', err.name, err.message);
            // Some browsers require user interaction
            alert('Click play again to start the music. Some browsers require user interaction.');
        });
    }
}

// Event Listeners
nextBtn.addEventListener('click', nextQuestion);
restartBtn.addEventListener('click', restartQuiz);
audioToggleBtn.addEventListener('click', toggleAudio);

// Initialize the quiz when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up audio event listeners for error/status handling
    backgroundMusic.addEventListener('loadeddata', () => {
        console.log('Audio asset loaded successfully: assets/bensound-hey.mp3');
    });
    
    backgroundMusic.addEventListener('error', (e) => {
        console.error('Error loading audio asset:', e);
        console.error('Audio source:', backgroundMusic.src);
    });
    
    backgroundMusic.addEventListener('canplay', () => {
        console.log('Audio can play - ready to use local asset');
    });
    
    initQuiz();
    console.log('Quiz initialized - using local audio: assets/bensound-hey.mp3');
});
