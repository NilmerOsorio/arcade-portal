/* ==========================================================================
   PIXEL PONG — Arcade Portal
   Vanilla JavaScript game engine: fixed-step loop, vector ball physics,
   dual-paddle input, three AI tiers, score state machine, canvas renderer.
   ========================================================================== */
(() => {
    "use strict";

    /* ----------------------------------------------------------------------
       1. Constants & configuration
       ---------------------------------------------------------------------- */
    const WORLD = Object.freeze({ width: 1000, height: 600 });
    // Rendering uses two world units per pixel; physics stays subpixel accurate.
    const PIXEL_SCALE = 2;

    const CONFIG = Object.freeze({
        paddle: Object.freeze({
            width: 14,
            height: 108,
            inset: 38,
            playerSpeed: 660
        }),
        ball: Object.freeze({
            radius: 10,
            baseSpeed: 520,
            maxSpeed: 1180,
            speedUp: 1.045,
            maxBounceAngle: (58 * Math.PI) / 180
        }),
        match: Object.freeze({
            target: 5,
            serveDelay: 0.85
        }),
        loop: Object.freeze({
            step: 1 / 120,
            maxSteps: 8,
            maxFrame: 0.05
        })
    });

    const KEYS = Object.freeze({
        p1Up: "KeyW",
        p1Down: "KeyS",
        p2Up: "ArrowUp",
        p2Down: "ArrowDown"
    });

    const DIFFICULTIES = Object.freeze({
        easy: Object.freeze({
            label: "Easy",
            speed: 340,
            reaction: 0.24,
            error: 58,
            mistakeChance: 0.16,
            mistakeOffset: 125,
            deadzone: 16,
            description: "Easy has a slow paddle, a long reaction delay, and occasional miscalculations."
        }),
        intermediate: Object.freeze({
            label: "Intermediate",
            speed: 540,
            reaction: 0.07,
            error: 20,
            mistakeChance: 0,
            mistakeOffset: 0,
            leadSeconds: 0.22,
            deadzone: 10,
            description: "Intermediate tracks the ball with a short reaction window, partial prediction, and a small aim error."
        }),
        hard: Object.freeze({
            label: "Difficult",
            speed: 780,
            reaction: 0.015,
            error: 4,
            mistakeChance: 0,
            mistakeOffset: 0,
            deadzone: 4,
            description: "Difficult moves fast and predicts the ball's full trajectory, including wall bounces, with almost no error."
        })
    });

    /* ----------------------------------------------------------------------
       2. Runtime state
       ---------------------------------------------------------------------- */
    const state = {
        phase: "menu",           // menu | playing | paused | gameover
        mode: "pvp",             // pvp | pvc
        difficulty: "intermediate",
        scores: { left: 0, right: 0 },
        winner: null,
        serveTimer: 0,
        serveDirection: 1,
        rally: 0,
        accumulator: 0
    };

    const leftPaddle = {
        x: CONFIG.paddle.inset,
        y: (WORLD.height - CONFIG.paddle.height) / 2,
        width: CONFIG.paddle.width,
        height: CONFIG.paddle.height,
        flash: 0
    };

    const rightPaddle = {
        x: WORLD.width - CONFIG.paddle.inset - CONFIG.paddle.width,
        y: (WORLD.height - CONFIG.paddle.height) / 2,
        width: CONFIG.paddle.width,
        height: CONFIG.paddle.height,
        flash: 0
    };

    const ball = {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        vx: 0,
        vy: 0,
        radius: CONFIG.ball.radius,
        trail: []
    };

    const ai = {
        targetY: WORLD.height / 2,
        decisionTimer: 0
    };

    const keys = new Set();
    const touchHeld = new Set();
    const touchPointers = new Map();
    const touchDrag = {
        left: { id: null, targetY: WORLD.height / 2 },
        right: { id: null, targetY: WORLD.height / 2 }
    };
    const overlayElements = {};

    let lastFrame = 0;
    let scoreAnimationTimer = 0;
    let bannerTimer = 0;

    /* ----------------------------------------------------------------------
       3. DOM references
       ---------------------------------------------------------------------- */
    const byId = (id) => document.getElementById(id);
    const canvas = byId("gameCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    const els = {
        app: byId("gameApp"),
        leftScore: byId("leftScore"),
        rightScore: byId("rightScore"),
        leftScorePanel: byId("leftScorePanel"),
        rightScorePanel: byId("rightScorePanel"),
        leftPlayerName: byId("leftPlayerName"),
        rightPlayerName: byId("rightPlayerName"),
        leftMeta: byId("leftMeta"),
        rightMeta: byId("rightMeta"),
        leftTag: document.querySelector(".score-panel--left .score-panel__tag"),
        rightTag: document.querySelector(".score-panel--right .score-panel__tag"),
        matchStatus: byId("matchStatus"),
        matchDetail: byId("matchDetail"),
        modeChip: byId("modeChip"),
        modeChipText: byId("modeChipText"),
        pauseButton: byId("pauseButton"),
        menuButton: byId("menuButton"),
        controlsRightLabel: byId("controlsRightLabel"),
        controlsRightGroup: byId("controlsRightGroup"),
        controlsLeftAltKeys: byId("controlsLeftAltKeys"),
        controlsDivider: byId("controlsDivider"),

        menuOverlay: byId("menuOverlay"),
        pauseOverlay: byId("pauseOverlay"),
        gameOverOverlay: byId("gameOverOverlay"),
        startButton: byId("startButton"),
        difficultyFieldset: byId("difficultyFieldset"),
        difficultyHelp: byId("difficultyHelp"),
        modeCards: Array.from(document.querySelectorAll(".mode-card")),
        difficultyButtons: Array.from(document.querySelectorAll(".difficulty__option")),

        resumeButton: byId("resumeButton"),
        restartButton: byId("restartButton"),
        pauseMenuButton: byId("pauseMenuButton"),
        rematchButton: byId("rematchButton"),
        gameOverMenuButton: byId("gameOverMenuButton"),

        pauseLeftName: byId("pauseLeftName"),
        pauseRightName: byId("pauseRightName"),
        pauseLeftScore: byId("pauseLeftScore"),
        pauseRightScore: byId("pauseRightScore"),

        winnerEyebrow: byId("winnerEyebrow"),
        winnerTitle: byId("winnerTitle"),
        winnerDescription: byId("winnerDescription"),
        finalLeftName: byId("finalLeftName"),
        finalRightName: byId("finalRightName"),
        finalLeftScore: byId("finalLeftScore"),
        finalRightScore: byId("finalRightScore"),
        finalLeftSide: byId("finalLeftSide"),
        finalRightSide: byId("finalRightSide"),

        pointBanner: byId("pointBanner"),
        pointBannerText: byId("pointBannerText"),
        touchControls: byId("touchControls"),
        touchButtons: Array.from(document.querySelectorAll(".touch-btn")),
        announcer: byId("announcer")
    };

    overlayElements.menu = els.menuOverlay;
    overlayElements.pause = els.pauseOverlay;
    overlayElements.gameover = els.gameOverOverlay;

    /* ----------------------------------------------------------------------
       4. Small helpers
       ---------------------------------------------------------------------- */
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const randomRange = (min, max) => min + Math.random() * (max - min);
    const randomSign = () => (Math.random() < 0.5 ? -1 : 1);

    const paddleCenter = (paddle) => paddle.y + paddle.height / 2;
    const paddleHalfHeight = (paddle) => paddle.height / 2;

    function resetPaddles() {
        leftPaddle.y = (WORLD.height - leftPaddle.height) / 2;
        rightPaddle.y = (WORLD.height - rightPaddle.height) / 2;
        leftPaddle.flash = 0;
        rightPaddle.flash = 0;
        ai.targetY = WORLD.height / 2;
        ai.decisionTimer = 0;
    }

    function resetBall() {
        ball.x = WORLD.width / 2;
        ball.y = WORLD.height / 2;
        ball.vx = 0;
        ball.vy = 0;
        ball.trail.length = 0;
    }

    function prepareServe(direction) {
        resetPaddles();
        resetBall();
        state.serveDirection = direction;
        state.serveTimer = CONFIG.match.serveDelay;
        state.rally = 0;
    }

    function launchServe() {
        const spread = 0.34; // radians, roughly ±19.5°
        const angle = randomRange(-spread, spread);

        ball.vx = Math.cos(angle) * CONFIG.ball.baseSpeed * state.serveDirection;
        ball.vy = Math.sin(angle) * CONFIG.ball.baseSpeed;
        ball.trail.length = 0;
        state.serveTimer = 0;
    }

    function getPlayerName(side) {
        if (side === "left") {
            return "Player 1";
        }
        return state.mode === "pvc" ? "Computer" : "Player 2";
    }

    function difficultyProfile() {
        return DIFFICULTIES[state.difficulty] || DIFFICULTIES.intermediate;
    }

    function announce(message) {
        if (!els.announcer) {
            return;
        }
        els.announcer.textContent = "";
        window.setTimeout(() => {
            els.announcer.textContent = message;
        }, 30);
    }

    function clearInput() {
        keys.clear();
        touchHeld.clear();
        touchPointers.clear();
        touchDrag.left.id = null;
        touchDrag.right.id = null;
        touchDrag.left.targetY = WORLD.height / 2;
        touchDrag.right.targetY = WORLD.height / 2;
        els.touchButtons.forEach((button) => {
            button.classList.remove("is-pressed");
        });
    }

    function setTouchControlsVisible(visible) {
        if (!els.touchControls) {
            return;
        }
        els.touchControls.hidden = !visible;
    }

    function setTouchControlsMode() {
        if (!els.touchControls) {
            return;
        }
        els.touchControls.classList.toggle("is-solo", state.mode === "pvc");
    }

    function paddleAxis(side) {
        const alternateArrows = side === "left" && state.mode === "pvc";
        const up =
            (side === "left" ? keys.has(KEYS.p1Up) : keys.has(KEYS.p2Up)) ||
            (alternateArrows && keys.has(KEYS.p2Up)) ||
            touchHeld.has(`${side}-up`);
        const down =
            (side === "left" ? keys.has(KEYS.p1Down) : keys.has(KEYS.p2Down)) ||
            (alternateArrows && keys.has(KEYS.p2Down)) ||
            touchHeld.has(`${side}-down`);

        return (down ? 1 : 0) - (up ? 1 : 0);
    }

    /* ----------------------------------------------------------------------
       5. Overlay & focus management
       ---------------------------------------------------------------------- */
    function hideOverlay(overlay) {
        if (!overlay) {
            return;
        }
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        overlay.setAttribute("inert", "");
        if (!Object.values(overlayElements).some((item) => item.classList.contains("is-open"))) {
            els.app?.removeAttribute("inert");
        }
    }

    function showOverlay(overlay, focusTarget) {
        Object.values(overlayElements).forEach((other) => {
            if (other !== overlay) {
                hideOverlay(other);
            }
        });

        overlay.classList.add("is-open");
        overlay.removeAttribute("inert");
        overlay.setAttribute("aria-hidden", "false");
        els.app?.setAttribute("inert", "");

        if (focusTarget) {
            window.requestAnimationFrame(() => {
                if (overlay.classList.contains("is-open")) {
                    focusTarget.focus({ preventScroll: true });
                }
            });
        }
    }

    function hideAllOverlays() {
        Object.values(overlayElements).forEach(hideOverlay);
    }

    function focusCanvas() {
        if (!canvas) {
            return;
        }
        window.requestAnimationFrame(() => {
            canvas.focus({ preventScroll: true });
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") {
            return;
        }

        const openOverlay = document.querySelector(".overlay.is-open");
        if (!openOverlay) {
            return;
        }

        const panel = openOverlay.querySelector(".panel");
        if (!panel) {
            return;
        }

        const focusables = Array.from(
            panel.querySelectorAll(
                'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
            )
        ).filter((element) => element.offsetParent !== null);

        if (focusables.length === 0) {
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (!panel.contains(document.activeElement)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
            return;
        }

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    /* ----------------------------------------------------------------------
       6. UI synchronisation
       ---------------------------------------------------------------------- */
    function paintScores(scoredSide) {
        if (!els.leftScore || !els.rightScore) {
            return;
        }

        els.leftScore.textContent = String(state.scores.left);
        els.rightScore.textContent = String(state.scores.right);
        els.pauseLeftScore.textContent = String(state.scores.left);
        els.pauseRightScore.textContent = String(state.scores.right);

        if (!scoredSide) {
            return;
        }

        const panel = scoredSide === "left" ? els.leftScorePanel : els.rightScorePanel;
        if (!panel) {
            return;
        }

        window.clearTimeout(scoreAnimationTimer);
        els.leftScorePanel.classList.remove("is-scored");
        els.rightScorePanel.classList.remove("is-scored");

        // Force a reflow so the animation can restart on consecutive points.
        void panel.offsetWidth;
        panel.classList.add("is-scored");

        scoreAnimationTimer = window.setTimeout(() => {
            panel.classList.remove("is-scored");
        }, 760);
    }

    function syncMatchupUI() {
        const profile = difficultyProfile();
        const rightName = getPlayerName("right");
        const isPvc = state.mode === "pvc";

        els.leftPlayerName.textContent = "Player 1";
        els.rightPlayerName.textContent = rightName;
        if (els.leftTag) {
            els.leftTag.textContent = "P1";
        }
        if (els.rightTag) {
            els.rightTag.textContent = isPvc ? "CPU" : "P2";
        }

        els.leftMeta.textContent = isPvc ? "W/S · ↑/↓" : "W / S";
        els.rightMeta.textContent = isPvc ? `AI · ${profile.label}` : "↑ / ↓";
        els.controlsRightLabel.textContent = isPvc ? "Computer (AI)" : "Player 2";
        els.controlsRightGroup.hidden = isPvc;
        els.controlsLeftAltKeys.hidden = !isPvc;
        els.controlsDivider.hidden = isPvc;

        els.pauseLeftName.textContent = "Player 1";
        els.pauseRightName.textContent = rightName;
        els.finalLeftName.textContent = "Player 1";
        els.finalRightName.textContent = rightName;

        setTouchControlsMode();
        els.modeChip.hidden = false;
        els.modeChip.className = `mode-chip mode-chip--${state.mode}`;
        els.modeChipText.textContent = isPvc ? `PvC · ${profile.label}` : "PvP · Local";
    }

    function resetMenuLabels() {
        els.leftPlayerName.textContent = "Player 1";
        els.rightPlayerName.textContent = "Player 2";
        if (els.leftTag) {
            els.leftTag.textContent = "P1";
        }
        if (els.rightTag) {
            els.rightTag.textContent = "P2";
        }
        els.leftMeta.textContent = "W / S";
        els.rightMeta.textContent = "↑ / ↓";
        els.controlsRightLabel.textContent = "Player 2";
        els.controlsRightGroup.hidden = false;
        els.controlsLeftAltKeys.hidden = true;
        els.controlsDivider.hidden = false;
        els.pauseLeftName.textContent = "Player 1";
        els.pauseRightName.textContent = "Player 2";
        setTouchControlsMode();
        els.modeChip.hidden = true;
    }

    function updateMatchHud() {
        const status = els.matchStatus;
        status.classList.remove("is-hot");

        if (state.phase === "menu") {
            status.textContent = "Choose your match";
            els.matchDetail.textContent = "Local duel or vs. computer";
            return;
        }

        if (state.phase === "paused") {
            status.textContent = "Paused";
            els.matchDetail.textContent = "Space or Esc to resume";
            return;
        }

        if (state.phase === "gameover") {
            status.textContent = "Match complete";
            els.matchDetail.textContent = state.winner
                ? `${getPlayerName(state.winner)} wins ${state.scores.left}–${state.scores.right}`
                : "Run it back?";
            return;
        }

        const leftScore = state.scores.left;
        const rightScore = state.scores.right;
        const target = CONFIG.match.target;

        if (leftScore === target - 1 && rightScore === target - 1) {
            status.textContent = "Double match point";
            status.classList.add("is-hot");
            els.matchDetail.textContent = "One point takes the set";
            return;
        }

        if (leftScore === target - 1 || rightScore === target - 1) {
            const leader = leftScore === target - 1 ? "left" : "right";
            status.textContent = "Match point";
            status.classList.add("is-hot");
            els.matchDetail.textContent = `${getPlayerName(leader)} needs one`;
            return;
        }

        status.textContent = "Match in progress";
        els.matchDetail.textContent = state.rally > 0
            ? `Rally ${String(state.rally).padStart(2, "0")} · first to ${target}`
            : `First to ${target} takes the set`;
    }

    function syncPauseButton() {
        const canPause = state.phase === "playing" || state.phase === "paused";
        const isPaused = state.phase === "paused";

        els.pauseButton.disabled = !canPause;
        els.pauseButton.textContent = isPaused ? "Resume" : "Pause";
        els.pauseButton.setAttribute("aria-label", isPaused ? "Resume the match" : "Pause the match");
    }

    function syncMenuSelection() {
        const isPvc = state.mode === "pvc";
        const profile = difficultyProfile();

        els.modeCards.forEach((card) => {
            card.setAttribute("aria-pressed", String(card.dataset.mode === state.mode));
        });

        els.difficultyButtons.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
        });

        els.difficultyFieldset.disabled = !isPvc;
        els.difficultyFieldset.setAttribute("aria-disabled", String(!isPvc));
        els.startButton.textContent = isPvc ? "Start Match vs. Computer" : "Start Local Match";
        els.difficultyHelp.textContent = profile.description;
    }

    function showPointBanner(side) {
        els.pointBannerText.textContent = `${getPlayerName(side)} scores`;
        els.pointBanner.classList.remove("is-visible");
        void els.pointBanner.offsetWidth;
        els.pointBanner.classList.add("is-visible");

        window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => {
            els.pointBanner.classList.remove("is-visible");
        }, 950);
    }

    function hidePointBanner() {
        window.clearTimeout(bannerTimer);
        els.pointBanner.classList.remove("is-visible");
    }

    /* ----------------------------------------------------------------------
       7. Match lifecycle
       ---------------------------------------------------------------------- */
    function startMatch() {
        state.phase = "playing";
        state.scores.left = 0;
        state.scores.right = 0;
        state.winner = null;
        state.accumulator = 0;
        state.rally = 0;

        clearInput();
        hideAllOverlays();
        hidePointBanner();
        syncMatchupUI();
        paintScores();
        prepareServe(randomSign());
        updateMatchHud();
        syncPauseButton();
        setTouchControlsVisible(true);

        announce(
            state.mode === "pvc"
                ? `Match started against the ${difficultyProfile().label} computer. First to ${CONFIG.match.target}.`
                : `Local match started. First to ${CONFIG.match.target}.`
        );

        focusCanvas();
    }

    function openMenu() {
        state.phase = "menu";
        state.scores.left = 0;
        state.scores.right = 0;
        state.winner = null;
        state.accumulator = 0;
        state.serveTimer = 0;

        clearInput();
        hidePointBanner();
        resetPaddles();
        resetBall();
        resetMenuLabels();
        paintScores();
        updateMatchHud();
        syncMenuSelection();
        syncPauseButton();
        setTouchControlsVisible(false);
        showOverlay(els.menuOverlay, els.startButton);
        announce("Main menu.");
    }

    function pauseGame() {
        if (state.phase !== "playing") {
            return;
        }

        state.phase = "paused";
        state.accumulator = 0;
        clearInput();

        paintScores();
        updateMatchHud();
        syncPauseButton();
        showOverlay(els.pauseOverlay, els.resumeButton);
        setTouchControlsVisible(false);
        announce("Match paused.");
    }

    function resumeGame() {
        if (state.phase !== "paused") {
            return;
        }

        state.phase = "playing";
        state.accumulator = 0;
        clearInput();

        hideOverlay(els.pauseOverlay);
        updateMatchHud();
        syncPauseButton();
        setTouchControlsVisible(true);
        focusCanvas();
        announce("Match resumed.");
    }

    function togglePause() {
        if (state.phase === "playing") {
            pauseGame();
        } else if (state.phase === "paused") {
            resumeGame();
        }
    }

    function endMatch(winner) {
        state.phase = "gameover";
        state.winner = winner;
        state.accumulator = 0;
        state.serveTimer = 0;

        clearInput();
        setTouchControlsVisible(false);
        resetBall();
        hidePointBanner();
        syncMatchupUI();
        paintScores();
        updateMatchHud();
        syncPauseButton();

        const profile = difficultyProfile();
        const winnerName = getPlayerName(winner);
        const isPvc = state.mode === "pvc";

        els.winnerEyebrow.textContent = "Match complete";
        els.winnerTitle.textContent = `${winnerName} wins!`;

        if (isPvc && winner === "left") {
            els.winnerDescription.textContent = `You took down the ${profile.label} computer. Ready to defend the court?`;
        } else if (isPvc) {
            els.winnerDescription.textContent = `The ${profile.label} computer takes the set. Adjust the difficulty or run it back.`;
        } else {
            els.winnerDescription.textContent = "A local showdown in the books. Run it back or pick a new mode.";
        }

        els.finalLeftScore.textContent = String(state.scores.left);
        els.finalRightScore.textContent = String(state.scores.right);
        els.finalLeftName.textContent = "Player 1";
        els.finalRightName.textContent = getPlayerName("right");
        els.finalLeftSide.classList.toggle("is-winner", winner === "left");
        els.finalRightSide.classList.toggle("is-winner", winner === "right");

        showOverlay(els.gameOverOverlay, els.rematchButton);
        announce(
            `${winnerName} wins the match ${state.scores.left} to ${state.scores.right}.`
        );
    }

    function awardPoint(side) {
        state.scores[side] += 1;
        paintScores(side);

        const name = getPlayerName(side);

        if (state.scores[side] >= CONFIG.match.target) {
            endMatch(side);
            return;
        }

        showPointBanner(side);

        // Serve toward the player who just conceded the point.
        prepareServe(side === "left" ? 1 : -1);
        updateMatchHud();

        announce(
            `${name} scores. Player 1 ${state.scores.left}, ${getPlayerName("right")} ${state.scores.right}.`
        );
    }

    /* ----------------------------------------------------------------------
       8. Input
       ---------------------------------------------------------------------- */
    const moveKeys = new Set([KEYS.p1Up, KEYS.p1Down, KEYS.p2Up, KEYS.p2Down]);

    function handleKeyDown(event) {
        // Space belongs to focused buttons and links, including modal actions.
        if (event.code === "Space" && event.target?.closest?.(
            'button, a[href], input, select, textarea, [contenteditable="true"]'
        )) {
            return;
        }
        const isPauseKey = event.code === "Space" || event.code === "KeyP";
        const isEscape = event.code === "Escape";

        if (isPauseKey || isEscape) {
            if (state.phase === "playing" || state.phase === "paused") {
                event.preventDefault();
                if (!event.repeat) {
                    togglePause();
                }
            }
            return;
        }

        if (moveKeys.has(event.code)) {
            if (event.code === "ArrowUp" || event.code === "ArrowDown") {
                if (state.phase === "playing") {
                    event.preventDefault();
                }
            }
            keys.add(event.code);
        }
    }

    function handleKeyUp(event) {
        keys.delete(event.code);
    }

    function touchWorldY(clientY) {
        const rect = canvas.getBoundingClientRect();
        if (rect.height <= 0) {
            return WORLD.height / 2;
        }
        return clamp(
            ((clientY - rect.top) / rect.height) * WORLD.height,
            0,
            WORLD.height
        );
    }

    function touchSide(clientX) {
        if (state.mode === "pvc") {
            return "left";
        }

        const rect = canvas.getBoundingClientRect();
        return clientX < rect.left + rect.width / 2 ? "left" : "right";
    }

    function beginCanvasTouch(touch) {
        const side = touchSide(touch.clientX);
        const drag = touchDrag[side];

        if (drag.id !== null && drag.id !== touch.identifier) {
            return;
        }

        drag.id = touch.identifier;
        drag.targetY = touchWorldY(touch.clientY);
    }

    function moveCanvasTouch(touch) {
        const side =
            touchDrag.left.id === touch.identifier
                ? "left"
                : touchDrag.right.id === touch.identifier
                    ? "right"
                    : null;

        if (side) {
            touchDrag[side].targetY = touchWorldY(touch.clientY);
        }
    }

    function endCanvasTouch(identifier) {
        if (touchDrag.left.id === identifier) {
            touchDrag.left.id = null;
        }
        if (touchDrag.right.id === identifier) {
            touchDrag.right.id = null;
        }
    }

    function handleTouchStart(event) {
        if (state.phase !== "playing") {
            return;
        }

        Array.from(event.changedTouches).forEach(beginCanvasTouch);
        event.preventDefault();
    }

    function handleTouchMove(event) {
        if (state.phase !== "playing") {
            return;
        }

        Array.from(event.changedTouches).forEach(moveCanvasTouch);
        event.preventDefault();
    }

    function handleTouchEnd(event) {
        Array.from(event.changedTouches).forEach((touch) => {
            endCanvasTouch(touch.identifier);
        });
    }

    function releaseTouchPointer(event) {
        const held = touchPointers.get(event.pointerId);
        if (!held) {
            return;
        }
        touchPointers.delete(event.pointerId);
        // A second finger can still be holding this same direction.
        if (![...touchPointers.values()].some((entry) => entry.key === held.key)) {
            touchHeld.delete(held.key);
            held.button.classList.remove("is-pressed");
        }
    }

    function bindTouchButtons() {
        els.touchButtons.forEach((button) => {
            const side = button.dataset.paddle;
            const direction = button.dataset.direction;
            if (!side || !direction) {
                return;
            }

            button.addEventListener("pointerdown", (event) => {
                if (state.phase !== "playing") {
                    return;
                }

                event.preventDefault();
                const key = `${side}-${direction}`;
                touchPointers.set(event.pointerId, { button, key });
                touchHeld.add(key);
                button.classList.add("is-pressed");

                if (button.setPointerCapture && event.pointerId !== undefined) {
                    try {
                        button.setPointerCapture(event.pointerId);
                    } catch (error) {
                        // Pointer capture is an enhancement; movement still works.
                    }
                }
            });

            button.addEventListener("pointerup", releaseTouchPointer);
            button.addEventListener("pointercancel", releaseTouchPointer);
            button.addEventListener("lostpointercapture", releaseTouchPointer);
            button.addEventListener("contextmenu", (event) => event.preventDefault());
        });
        // Also release outside a button if pointer capture is unavailable.
        window.addEventListener("pointerup", releaseTouchPointer);
        window.addEventListener("pointercancel", releaseTouchPointer);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    window.addEventListener("blur", () => {
        clearInput();
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearInput();
            if (state.phase === "playing") {
                pauseGame();
            }
        }
    });

    /* ----------------------------------------------------------------------
       9. Physics & simulation
       ---------------------------------------------------------------------- */
    function followTouchDrag(paddle, side, dt) {
        const drag = touchDrag[side];
        if (drag.id === null) {
            return false;
        }

        const desiredY = clamp(
            drag.targetY - paddle.height / 2,
            0,
            WORLD.height - paddle.height
        );
        const follow = 1 - Math.exp(-28 * dt);
        paddle.y += (desiredY - paddle.y) * follow;

        if (Math.abs(desiredY - paddle.y) < 0.35) {
            paddle.y = desiredY;
        }
        return true;
    }

    function updatePlayerPaddles(dt) {
        const move = CONFIG.paddle.playerSpeed * dt;

        if (!followTouchDrag(leftPaddle, "left", dt)) {
            const leftDirection = paddleAxis("left");
            leftPaddle.y = clamp(
                leftPaddle.y + leftDirection * move,
                0,
                WORLD.height - leftPaddle.height
            );
        }

        if (state.mode === "pvp") {
            if (!followTouchDrag(rightPaddle, "right", dt)) {
                const rightDirection = paddleAxis("right");
                rightPaddle.y = clamp(
                    rightPaddle.y + rightDirection * move,
                    0,
                    WORLD.height - rightPaddle.height
                );
            }
        } else {
            updateAI(dt);
        }
    }

    function updateAI(dt) {
        const profile = difficultyProfile();

        ai.decisionTimer -= dt;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = Math.max(profile.reaction, 0.012);
            chooseAITarget(profile);
        }

        const currentCenter = paddleCenter(rightPaddle);
        const difference = ai.targetY - currentCenter;

        if (Math.abs(difference) <= profile.deadzone) {
            return;
        }

        const maxMove = profile.speed * dt;
        if (Math.abs(difference) <= maxMove) {
            rightPaddle.y = clamp(
                ai.targetY - paddleHalfHeight(rightPaddle),
                0,
                WORLD.height - rightPaddle.height
            );
        } else {
            rightPaddle.y = clamp(
                rightPaddle.y + Math.sign(difference) * maxMove,
                0,
                WORLD.height - rightPaddle.height
            );
        }
    }

    function chooseAITarget(profile) {
        if (state.serveTimer > 0 || ball.vx <= 0) {
            ai.targetY = WORLD.height / 2;
            return;
        }

        const paddlePlane = rightPaddle.x - ball.radius;
        let targetY = ball.y;

        if (state.difficulty === "hard") {
            const prediction = predictInterceptY(paddlePlane);
            targetY = prediction === null ? WORLD.height / 2 : prediction;
        } else if (state.difficulty === "intermediate") {
            const travelTime = Math.max(0, paddlePlane - ball.x) / Math.max(ball.vx, 1);
            const lead = Math.min(travelTime, profile.leadSeconds);
            targetY = ball.y + ball.vy * lead;
        }

        if (profile.mistakeChance > 0 && Math.random() < profile.mistakeChance) {
            // Easy's occasional miscalculation: aim clearly off the incoming line.
            targetY += randomSign() * profile.mistakeOffset;
        } else if (profile.error > 0) {
            targetY += randomRange(-profile.error, profile.error);
        }

        ai.targetY = clamp(
            targetY,
            paddleHalfHeight(rightPaddle),
            WORLD.height - paddleHalfHeight(rightPaddle)
        );
    }

    /**
     * Fold a predicted Y coordinate through the top/bottom walls.
     * The triangular wave keeps the exact bounce path without simulation.
     */
    function predictInterceptY(planeX) {
        if (ball.vx <= 0) {
            return null;
        }

        const timeToPlane = (planeX - ball.x) / ball.vx;
        if (timeToPlane <= 0) {
            return null;
        }

        const rawY = ball.y + ball.vy * timeToPlane;
        const minY = ball.radius;
        const maxY = WORLD.height - ball.radius;
        const span = maxY - minY;

        if (span <= 0) {
            return rawY;
        }

        const period = span * 2;
        let offset = (rawY - minY) % period;
        if (offset < 0) {
            offset += period;
        }
        if (offset > span) {
            offset = period - offset;
        }

        return minY + offset;
    }

    function moveBall(dt) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 18) {
            ball.trail.shift();
        }
    }

    function resolveWalls() {
        const minY = ball.radius;
        const maxY = WORLD.height - ball.radius;

        if (ball.y < minY) {
            ball.y = minY + (minY - ball.y);
            ball.vy = Math.abs(ball.vy);
        } else if (ball.y > maxY) {
            ball.y = maxY - (ball.y - maxY);
            ball.vy = -Math.abs(ball.vy);
        }
    }

    function circleOverlapsPaddle(paddle) {
        const closestX = clamp(ball.x, paddle.x, paddle.x + paddle.width);
        const closestY = clamp(ball.y, paddle.y, paddle.y + paddle.height);
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        return dx * dx + dy * dy <= ball.radius * ball.radius;
    }

    function resolvePaddle(paddle, side) {
        const movingTowardPaddle = side === "left" ? ball.vx < 0 : ball.vx > 0;

        if (!movingTowardPaddle || !circleOverlapsPaddle(paddle)) {
            return;
        }

        const relativeHit = clamp(
            (ball.y - paddleCenter(paddle)) / paddleHalfHeight(paddle),
            -1,
            1
        );

        const currentSpeed = Math.hypot(ball.vx, ball.vy) || CONFIG.ball.baseSpeed;
        const nextSpeed = Math.min(
            currentSpeed * CONFIG.ball.speedUp,
            CONFIG.ball.maxSpeed
        );

        // The outer edge of the paddle produces the sharpest deflection.
        const bounceAngle = relativeHit * CONFIG.ball.maxBounceAngle;
        const direction = side === "left" ? 1 : -1;

        ball.x = side === "left"
            ? paddle.x + paddle.width + ball.radius + 0.5
            : paddle.x - ball.radius - 0.5;

        ball.vx = Math.cos(bounceAngle) * nextSpeed * direction;
        ball.vy = Math.sin(bounceAngle) * nextSpeed;

        paddle.flash = 0.17;
        state.rally += 1;
        updateMatchHud();
    }

    function checkGoal() {
        if (ball.x + ball.radius < 0) {
            awardPoint("right");
            return false;
        }
        if (ball.x - ball.radius > WORLD.width) {
            awardPoint("left");
            return false;
        }
        return true;
    }

    function stepSimulation(dt) {
        updatePlayerPaddles(dt);

        leftPaddle.flash = Math.max(0, leftPaddle.flash - dt);
        rightPaddle.flash = Math.max(0, rightPaddle.flash - dt);

        if (state.serveTimer > 0) {
            state.serveTimer = Math.max(0, state.serveTimer - dt);
            if (state.serveTimer === 0) {
                launchServe();
            }
            return true;
        }

        moveBall(dt);
        resolveWalls();
        resolvePaddle(leftPaddle, "left");
        resolvePaddle(rightPaddle, "right");
        return checkGoal();
    }

    /* ----------------------------------------------------------------------
       10. Canvas renderer
       ---------------------------------------------------------------------- */
    function resizeCanvas() {
        if (!canvas) {
            return;
        }
        // A stable framebuffer keeps the same pixel size at every device DPR.
        // CSS scales this surface; touch coordinates still map into WORLD.
        const width = WORLD.width / PIXEL_SCALE;
        const height = WORLD.height / PIXEL_SCALE;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        ctx.imageSmoothingEnabled = false;
    }

    // Small original bitmap alphabet: scores and serve cues work offline.
    const PIXEL_GLYPHS = Object.freeze({
        "0": ["111", "101", "101", "101", "111"],
        "1": ["010", "110", "010", "010", "111"],
        "2": ["111", "001", "111", "100", "111"],
        "3": ["111", "001", "111", "001", "111"],
        "4": ["101", "101", "111", "001", "001"],
        "5": ["111", "100", "111", "001", "111"],
        "6": ["111", "100", "111", "101", "111"],
        "7": ["111", "001", "010", "010", "010"],
        "8": ["111", "101", "111", "101", "111"],
        "9": ["111", "101", "111", "001", "111"],
        "A": ["010", "101", "111", "101", "101"],
        "D": ["110", "101", "101", "101", "110"],
        "E": ["111", "100", "110", "100", "111"],
        "G": ["111", "100", "101", "101", "111"],
        "R": ["110", "101", "110", "101", "101"],
        "S": ["111", "100", "111", "001", "111"],
        "T": ["111", "010", "010", "010", "010"],
        "V": ["101", "101", "101", "101", "010"],
        "Y": ["101", "101", "010", "010", "010"]
    });

    function drawPixelText(text, centerX, y, size, color) {
        const width = (text.length * 4 - 1) * size;
        const startX = Math.round(centerX - width / 2);
        ctx.fillStyle = color;
        [...text].forEach((letter, index) => {
            const glyph = PIXEL_GLYPHS[letter];
            if (!glyph) {
                return;
            }
            glyph.forEach((row, rowIndex) => {
                [...row].forEach((pixel, columnIndex) => {
                    if (pixel === "1") {
                        ctx.fillRect(
                            startX + (index * 4 + columnIndex) * size,
                            y + rowIndex * size,
                            size,
                            size
                        );
                    }
                });
            });
        });
    }

    function drawCornerBracket(x, y, xDir, yDir, color) {
        ctx.fillStyle = color;
        ctx.fillRect(xDir > 0 ? x : x - 12, y, 14, 2);
        ctx.fillRect(x, yDir > 0 ? y : y - 12, 2, 14);
    }

    function drawArena() {
        const width = canvas.width;
        const height = canvas.height;
        ctx.fillStyle = "#101222";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#14182b";
        ctx.fillRect(0, 0, width / 2, height);

        // Quiet pixel grid with dithered edges, keeping the ball easy to read.
        ctx.fillStyle = "#202338";
        for (let x = 25; x < width; x += 25) {
            for (let y = 25; y < height; y += 25) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
        for (let y = 4; y < height - 4; y += 8) {
            ctx.fillStyle = "#21364b";
            ctx.fillRect(3, y, 2, 2);
            ctx.fillStyle = "#402338";
            ctx.fillRect(width - 5, y, 2, 2);
        }

        ctx.fillStyle = "#453853";
        ctx.fillRect(12, 0, width - 24, 2);
        ctx.fillRect(12, height - 2, width - 24, 2);
        ctx.fillStyle = "#534866";
        for (let y = 8; y < height; y += 14) {
            ctx.fillRect(width / 2 - 1, y, 2, 6);
        }

        drawPixelText(String(state.scores.left).padStart(2, "0"), width / 4, 28, 5, "#29485f");
        drawPixelText(String(state.scores.right).padStart(2, "0"), width * 3 / 4, 28, 5, "#573047");
        drawCornerBracket(10, 10, 1, 1, "#38bdf8");
        drawCornerBracket(width - 12, 10, -1, 1, "#f43f5e");
        drawCornerBracket(10, height - 12, 1, -1, "#29485f");
        drawCornerBracket(width - 12, height - 12, -1, -1, "#573047");
    }

    function drawTrail() {
        const color = ball.vx >= 0 ? "#f43f5e" : "#38bdf8";
        ctx.save();
        ctx.fillStyle = color;
        // Skip samples to leave a deliberate stepped, blocky tail.
        for (let index = 0; index < ball.trail.length; index += 3) {
            const point = ball.trail[index];
            const progress = (index + 1) / ball.trail.length;
            const size = 2 + Math.floor(progress * 5);
            ctx.globalAlpha = progress * 0.3;
            ctx.fillRect(
                Math.round(point.x / PIXEL_SCALE - size / 2),
                Math.round(point.y / PIXEL_SCALE - size / 2),
                size,
                size
            );
        }
        ctx.restore();
    }

    function drawPaddle(paddle, colors) {
        const x = Math.round(paddle.x / PIXEL_SCALE);
        const y = Math.round(paddle.y / PIXEL_SCALE);
        const width = Math.round(paddle.width / PIXEL_SCALE);
        const height = Math.round(paddle.height / PIXEL_SCALE);
        ctx.fillStyle = colors.dark;
        ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
        ctx.fillStyle = paddle.flash > 0 ? "#f3f1ff" : colors.main;
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = colors.light;
        ctx.fillRect(x, y, 2, height);
        ctx.fillRect(x + 2, y, width - 2, 2);
        ctx.fillStyle = colors.dark;
        for (let offset = 9; offset < height - 2; offset += 10) {
            ctx.fillRect(x + 2, y + offset, width - 2, 1);
        }
    }

    function drawBall() {
        const x = Math.round((ball.x - ball.radius) / PIXEL_SCALE);
        const y = Math.round((ball.y - ball.radius) / PIXEL_SCALE);
        const size = Math.round(ball.radius * 2 / PIXEL_SCALE);
        // Clipped corners keep the sprite close to its circular collision area.
        ctx.fillStyle = ball.vx >= 0 ? "#f43f5e" : "#38bdf8";
        ctx.fillRect(x + 2, y, size - 4, size);
        ctx.fillRect(x, y + 2, size, size - 4);
        ctx.fillStyle = "#f3f1ff";
        ctx.fillRect(x + 2, y + 1, size - 4, size - 3);
        ctx.fillRect(x + 1, y + 2, size - 3, size - 5);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 2, y + 2, 3, 3);
    }

    function drawServeIndicator() {
        if (state.phase !== "playing" || state.serveTimer <= 0) {
            return;
        }
        const x = Math.round(ball.x / PIXEL_SCALE);
        const y = Math.round(ball.y / PIXEL_SCALE);
        drawCornerBracket(x - 15, y - 15, 1, 1, "#8b5cf6");
        drawCornerBracket(x + 13, y + 13, -1, -1, "#8b5cf6");
        drawPixelText(state.serveTimer > 0.35 ? "GET READY" : "SERVE", x, y - 34, 2, "#bfadff");
    }

    function render() {
        if (!ctx) {
            return;
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        drawArena();
        drawTrail();
        drawPaddle(leftPaddle, { main: "#38bdf8", light: "#b9edff", dark: "#24445e" });
        drawPaddle(rightPaddle, { main: "#f43f5e", light: "#ffbdce", dark: "#5b2943" });
        drawBall();
        drawServeIndicator();
        ctx.restore();
    }

    /* ----------------------------------------------------------------------
       11. Main loop
       ---------------------------------------------------------------------- */
    function frame(now) {
        if (!lastFrame) {
            lastFrame = now;
        }

        let delta = (now - lastFrame) / 1000;
        lastFrame = now;

        if (!Number.isFinite(delta) || delta < 0) {
            delta = 0;
        }
        delta = Math.min(delta, CONFIG.loop.maxFrame);

        if (state.phase === "playing") {
            state.accumulator += delta;
            let steps = 0;

            while (
                state.accumulator >= CONFIG.loop.step &&
                steps < CONFIG.loop.maxSteps
            ) {
                const stillPlaying = stepSimulation(CONFIG.loop.step);
                state.accumulator -= CONFIG.loop.step;
                steps += 1;

                if (!stillPlaying) {
                    state.accumulator = 0;
                    break;
                }
            }

            if (steps >= CONFIG.loop.maxSteps) {
                state.accumulator = 0;
            }
        } else {
            state.accumulator = 0;
        }

        render();
        window.requestAnimationFrame(frame);
    }

    /* ----------------------------------------------------------------------
       12. Event wiring & boot
       ---------------------------------------------------------------------- */
    function wireEvents() {
        els.modeCards.forEach((card) => {
            card.addEventListener("click", () => {
                state.mode = card.dataset.mode === "pvc" ? "pvc" : "pvp";
                syncMenuSelection();
            });
        });

        els.difficultyButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const selected = button.dataset.difficulty;
                if (selected && DIFFICULTIES[selected]) {
                    state.difficulty = selected;
                    syncMenuSelection();
                }
            });
        });

        els.startButton.addEventListener("click", startMatch);
        els.pauseButton.addEventListener("click", togglePause);
        els.menuButton.addEventListener("click", openMenu);
        els.resumeButton.addEventListener("click", resumeGame);
        els.restartButton.addEventListener("click", startMatch);
        els.pauseMenuButton.addEventListener("click", openMenu);
        els.rematchButton.addEventListener("click", startMatch);
        els.gameOverMenuButton.addEventListener("click", openMenu);

        window.addEventListener("resize", resizeCanvas, { passive: true });
        document.addEventListener("orientationchange", resizeCanvas, { passive: true });

        if ("ResizeObserver" in window) {
            const observer = new ResizeObserver(resizeCanvas);
            observer.observe(canvas);
        }
    }

    function init() {
        if (!ctx) {
            return;
        }

        resizeCanvas();
        wireEvents();
        bindTouchButtons();
        if (canvas) {
            canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
            canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
            canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
            canvas.addEventListener("touchcancel", handleTouchEnd, { passive: true });
        }
        resetPaddles();
        resetBall();
        paintScores();
        syncMenuSelection();
        syncPauseButton();
        updateMatchHud();
        clearInput();
        setTouchControlsVisible(false);
        setTouchControlsMode();
        showOverlay(els.menuOverlay, els.startButton);
        render();
        window.requestAnimationFrame(frame);
    }

    init();
})();
