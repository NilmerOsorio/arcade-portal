const RunnerPhysics = (() => {
    // Canvas pixels and seconds. Horizontal track speed is independent of these values.
    const tuning = Object.freeze({
        startX: 80,
        standWidth: 64,
        standHeight: 72,
        duckWidth: 78,
        duckHeight: 36,
        gravity: 2880,
        jumpSpeed: 936,
        releasedGravityScale: 1.55,
        fastFallGravityScale: 2.2
    });

    function createDino(groundY) {
        return {
            x: tuning.startX, y: groundY - tuning.standHeight,
            width: tuning.standWidth, height: tuning.standHeight, vy: 0,
            grounded: true, ducking: false, downHeld: false, jumpReleased: false
        };
    }

    function setDuck(dino, down) {
        dino.downHeld = down;
        if (!dino.grounded || dino.ducking === down) return;
        const feet = dino.y + dino.height;
        dino.ducking = down;
        dino.width = down ? tuning.duckWidth : tuning.standWidth;
        dino.height = down ? tuning.duckHeight : tuning.standHeight;
        dino.y = feet - dino.height;
    }

    function jump(dino) {
        if (!dino.grounded || dino.ducking) return false;
        dino.grounded = false;
        dino.jumpReleased = false;
        dino.vy = -tuning.jumpSpeed;
        return true;
    }

    function releaseJump(dino) {
        if (!dino.grounded && dino.vy < 0) dino.jumpReleased = true;
    }

    function integrate(dino, dt, gravity) {
        dino.y += dino.vy * dt + gravity * dt * dt / 2;
        dino.vy += gravity * dt;
    }

    function step(dino, dt, groundY) {
        if (dino.grounded || dt <= 0) return;
        if (dino.vy < 0) {
            const gravity = tuning.gravity * (dino.jumpReleased ? tuning.releasedGravityScale : 1);
            const toApex = -dino.vy / gravity;
            if (dt < toApex) {
                integrate(dino, dt, gravity);
                return;
            }
            // Split exactly at the apex when the rise and fall use different gravity.
            integrate(dino, toApex, gravity);
            dino.vy = 0;
            dt -= toApex;
        }
        integrate(dino, dt, tuning.gravity * (dino.downHeld ? tuning.fastFallGravityScale : 1));
        if (dino.y + dino.height >= groundY) {
            dino.y = groundY - dino.height;
            dino.vy = 0;
            dino.grounded = true;
            setDuck(dino, dino.downHeld);
        }
    }

    // Boxes cover painted pixels on each sprite's native grid. Transparent corners
    // and flapping wing tips can be grazed. Normalize once so cacti can vary in size.
    function spriteBoxes(cols, rows, rectangles) {
        return rectangles.map(([x, y, w, h]) => [x / cols, y / rows, (x + w) / cols, (y + h) / rows]);
    }
    const standingBoxes = spriteBoxes(21, 21, [
        [13, 1, 7, 5], [12, 6, 3, 4], [8, 9, 7, 5], [4, 12, 7, 3],
        [7, 15, 6, 2], [11, 17, 3, 4], [6, 17, 2, 3]
    ]);
    const duckingBoxes = spriteBoxes(26, 12, [
        [18, 1, 7, 4], [7, 4, 12, 4], [10, 7, 4, 3], [3, 3, 5, 2]
    ]);
    const cactusBoxes = spriteBoxes(11, 17, [
        [4, 1, 4, 16], [0, 4, 3, 4], [2, 7, 3, 2], [8, 6, 3, 5], [7, 10, 2, 1]
    ]);
    const birdBoxes = spriteBoxes(29, 17, [
        [1, 8, 6, 1], [6, 5, 4, 4], [9, 8, 12, 3], [12, 7, 5, 2]
    ]);

    function hitsObstacle(dino, obstacle) {
        if (dino.x + dino.width <= obstacle.x || dino.x >= obstacle.x + obstacle.width ||
            dino.y + dino.height <= obstacle.y || dino.y >= obstacle.y + obstacle.height) return false;
        const playerBoxes = dino.ducking ? duckingBoxes : standingBoxes;
        const hazardBoxes = obstacle.kind === 'bird' ? birdBoxes : cactusBoxes;
        for (const [x1, y1, x2, y2] of playerBoxes) {
            const left = dino.x + x1 * dino.width;
            const top = dino.y + y1 * dino.height;
            const right = dino.x + x2 * dino.width;
            const bottom = dino.y + y2 * dino.height;
            for (const [u1, v1, u2, v2] of hazardBoxes) {
                if (left < obstacle.x + u2 * obstacle.width && right > obstacle.x + u1 * obstacle.width &&
                    top < obstacle.y + v2 * obstacle.height && bottom > obstacle.y + v1 * obstacle.height) return true;
            }
        }
        return false;
    }

    return { tuning, createDino, jump, releaseJump, setDuck, step, hitsObstacle };
})();
