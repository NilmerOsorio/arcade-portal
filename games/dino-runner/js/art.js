// Paint at half the playfield resolution so moving scenery and sprites share one pixel grid.
function createRunnerArt(canvas, groundY) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    const ground = groundY / 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;

    function bitmap(w, h, paint) {
        const tile = document.createElement('canvas');
        tile.width = w;
        tile.height = h;
        paint(tile.getContext('2d'));
        return tile;
    }

    function rect(p, color, x, y, w, h) {
        p.fillStyle = color;
        p.fillRect(x, y, w, h);
    }

    // Integer spans give the ridges and the illuminated faces the same stepped edges.
    function polygon(p, color, points) {
        const ys = points.map(point => point[1]);
        const bottom = Math.max(...ys);
        for (let y = Math.min(...ys); y < bottom; y++) {
            const crossings = [];
            points.forEach(([x1, y1], i) => {
                const [x2, y2] = points[(i + 1) % points.length];
                if (y >= Math.min(y1, y2) && y < Math.max(y1, y2)) {
                    crossings.push(Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1)));
                }
            });
            crossings.sort((a, b) => a - b);
            for (let i = 0; i < crossings.length; i += 2) {
                rect(p, color, crossings[i], y, crossings[i + 1] - crossings[i], 1);
            }
        }
    }

    const sky = bitmap(width, ground, p => {
        const dusk = p.createLinearGradient(0, 0, 0, ground);
        dusk.addColorStop(0, '#26254e');
        dusk.addColorStop(0.30, '#5d4073');
        dusk.addColorStop(0.64, '#c17a91');
        dusk.addColorStop(1, '#f6b18f');
        p.fillStyle = dusk;
        p.fillRect(0, 0, width, ground);
        for (const [x, y] of [[12,18],[39,35],[58,8],[80,23],[96,13],[123,40],[148,21],[161,6],
            [187,32],[205,13],[236,26],[249,8],[271,16],[323,12],[351,31],[371,9],[388,22]]) {
            rect(p, '#b79cbe', x, y, 1, 1);
        }
        for (const [x, y] of [[74,34],[219,20],[356,14]]) {
            rect(p, '#b69ebc', x - 1, y, 3, 1);
            rect(p, '#efd2cf', x, y - 1, 1, 3);
        }

        const sunX = 298, sunY = 54, radius = 31;
        const sunlight = ['#ffdfac', '#ffd19f', '#ffc197', '#ffb18e', '#fa9e89'];
        for (let dy = -radius; dy <= radius; dy++) {
            if (dy === 4 || dy === 11 || (dy >= 17 && dy % 6 < 2)) continue;
            const half = Math.round(Math.sqrt(radius * radius - dy * dy));
            const band = Math.min(4, Math.floor((dy + radius) * 5 / (radius * 2)));
            rect(p, sunlight[band], sunX - half, sunY + dy, 2 * half + 1, 1);
        }
        // Sparse banks of vapour cross the lower sky, leaving the play area calm.
        for (const [x, y, w] of [[-9,61,43],[37,48,33],[117,53,50],[193,64,28],[253,71,39],[344,58,53]]) {
            rect(p, '#a46d8d', x, y, w, 2);
            rect(p, '#b97d96', x + 5, y - 1, Math.floor(w * 0.68), 2);
            rect(p, '#c48b9e', x + 12, y - 2, Math.floor(w * 0.26), 1);
        }
    });

    const farRidge = bitmap(width, ground, p => {
        const ridge = [[0,92],[17,85],[32,85],[50,69],[65,83],[76,78],[95,91],[120,81],
            [133,65],[144,64],[162,83],[184,90],[208,73],[218,75],[237,58],[252,72],
            [267,83],[279,77],[299,87],[323,76],[339,62],[346,65],[368,84],[385,83],[400,92]];
        polygon(p, '#946a88', [...ridge,[400,ground],[0,ground]]);
        polygon(p, '#ac7c91', [[119,82],[133,65],[144,64],[137,69],[136,74],[130,74]]);
        polygon(p, '#b08093', [[214,80],[237,58],[251,71],[239,64],[235,68],[231,68],[227,74]]);
        polygon(p, '#a7798f', [[319,82],[339,62],[346,65],[340,65],[333,73],[329,73]]);
        polygon(p, '#805d80', [[0,99],[24,92],[40,94],[67,85],[81,93],[105,88],[131,98],
            [153,84],[174,90],[192,86],[217,101],[242,87],[256,89],[285,80],[313,94],
            [344,86],[363,94],[377,89],[400,99],[400,ground],[0,ground]]);
    });

    const mesas = bitmap(width, ground, p => {
        // Flat caprock, steep walls and talus slopes distinguish mesas from the far ridge.
        function butte(x, y, w, base) {
            const h = base - y;
            const point = ([u, v]) => [x + Math.round(u * w), y + Math.round(v * h)];
            const face = (color, points) => polygon(p, color, points.map(point));
            face('#62476d', [[0,1],[.17,.77],[.24,.68],[.27,.38],[.32,.32],[.33,.09],
                [.37,.09],[.37,0],[.66,0],[.68,.09],[.72,.1],[.73,.34],[.78,.4],
                [.82,.66],[.88,.73],[1,1]]);
            face('#986583', [[.37,0],[.66,0],[.68,.09],[.72,.1],[.71,.19],[.58,.19],
                [.55,.28],[.51,.26],[.49,.15],[.36,.13]]);
            face('#855a7c', [[.62,.20],[.72,.19],[.73,.35],[.78,.4],[.82,.66],[.88,.73],
                [.97,.94],[.78,.78],[.7,.56],[.67,.53]]);
            face('#765273', [[.33,.29],[.46,.3],[.43,.34],[.32,.36]]);
            rect(p, '#ab7790', x + Math.round(.37 * w), y, Math.round(.29 * w), 1);
        }
        butte(4, 78, 69, 124);
        butte(76, 96, 52, 126);
        butte(151, 72, 72, 125);
        butte(217, 85, 28, 120);
        butte(308, 82, 82, 126);
        polygon(p, '#594563', [[0,115],[27,106],[54,111],[84,105],[113,117],[136,107],
            [162,115],[195,104],[221,112],[247,105],[274,111],[295,100],[318,109],
            [350,106],[379,111],[400,115],[400,ground],[0,ground]]);
    });

    const foothills = bitmap(width, ground, p => {
        polygon(p, '#423650', [[0,131],[28,119],[42,119],[64,126],[82,121],[102,132],
            [126,124],[146,127],[166,118],[182,116],[204,127],[220,121],[238,128],
            [263,120],[281,124],[300,117],[319,125],[345,119],[365,127],[382,126],
            [400,131],[400,ground],[0,ground]]);
        polygon(p, '#332e47', [[0,139],[23,136],[35,137],[52,133],[73,138],[98,135],
            [128,139],[153,134],[180,138],[211,134],[237,138],[261,133],[279,136],
            [309,132],[332,137],[356,134],[377,138],[400,139],[400,ground],[0,ground]]);
        for (const [x, y, w] of [[13,134,13],[67,131,10],[97,137,7],[155,129,17],
            [193,135,12],[248,133,10],[296,128,9],[348,131,16]]) {
            rect(p, '#5a445c', x, y, w, 1);
        }
    });

    const track = bitmap(200, height - ground, p => {
        rect(p, '#2a253b', 0, 0, 200, height - ground);
        rect(p, '#f0b58f', 0, 0, 200, 2);
        rect(p, '#bd7d80', 0, 2, 200, 2);
        polygon(p, '#795570', [[0,4],[200,4],[200,9],[183,8],[169,11],[142,9],
            [125,12],[99,8],[77,9],[68,12],[46,9],[32,10],[13,8],[0,9]]);
        polygon(p, '#44364d', [[0,10],[21,9],[43,11],[69,15],[85,12],[108,11],
            [135,15],[160,11],[183,12],[200,10],[200,14],[180,17],[145,16],
            [126,19],[94,15],[68,20],[42,15],[21,14],[0,15]]);
        for (const [x, y, w] of [[7,3,11],[34,5,9],[57,4,4],[79,2,12],[96,6,6],
            [124,4,15],[156,2,7],[181,5,11]]) rect(p, '#dc9c87', x, y, w, 1);
        for (const [x, y, w] of [[3,22,8],[32,18,5],[54,27,12],[86,21,16],[108,27,5],
            [131,22,9],[158,29,14],[186,20,8]]) rect(p, '#4b3b51', x, y, w, 1);
    });

    function sprite(rows, colors) {
        return bitmap(Math.max(...rows.map(row => row.length)), rows.length, p => {
            rows.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] !== '.') rect(p, colors[row[x]], x, y, 1, 1);
                }
            });
        });
    }

    const dinoSprite = sprite([
        '.............#######.', '............#hhhhhhh#', '............#hhw#llh#',
        '............#ll##lll#', '............#lllllll#', '............#lll#####',
        '............#lhhh#...', '..........###ll##....', '.#.......#sllll#.....',
        '.h#.....#sllhhl#.....', '.hl#...#sllllll##....', '.shl###slllhhlllh#...',
        '..shllllllhhlhl#.#...', '...slllllllslll#.....', '....sslllsslll#......',
        '.....#sssssll#.......', '......##sssll#.......', '......#ls#.#l#.......',
        '.....#ss#..#l#.......', '.....###...#lh#......', '...........####......'
    ], { '#':'#233a44', h:'#c3f39a', w:'#fff3c7', l:'#8ed984', s:'#4c9e76' });

    const cactus = sprite([
        '.....##....', '....#hl#...', '....#hl#...', '.#..#hl#...', '#hl.#hl#...',
        '#hl.#hl#.#.', '#hl.#sl##hl', '#hl##hl##hl', '.shhshl##hl', '..##shl#shl',
        '....#hlhhl#', '....#hs###.', '....#hl#...', '....#hl#...', '....#sl#...',
        '....#sl#...', '....####...'
    ], { '#':'#263e47', h:'#c0df8d', l:'#7dbd79', s:'#468b70' });

    function scroll(tile, distance, speed, y = 0) {
        const offset = Math.floor(distance * speed / 2) % tile.width;
        for (let x = -offset; x < width; x += tile.width) ctx.drawImage(tile, x, y);
    }

    function drawCactus(x, y, w, h) {
        ctx.drawImage(cactus, Math.round(x / 2), Math.round(y / 2), Math.round(w / 2), Math.round(h / 2));
    }

    return function drawScene({ distance, dino, obstacles, preview }) {
        ctx.drawImage(sky, 0, 0);
        scroll(farRidge, distance, 0.08);
        scroll(mesas, distance, 0.19);
        scroll(foothills, distance, 0.37);
        scroll(track, distance, 1, ground);
        if (preview) {
            drawCactus(614, groundY - 64, 38, 64);
            drawCactus(670, groundY - 40, 24, 40);
        }
        for (const obstacle of obstacles) drawCactus(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        const x = Math.round((preview ? 405 : dino.x) / 2);
        const y = Math.round(dino.y / 2);
        const w = Math.round(dino.width / 2), h = Math.round(dino.height / 2);
        const lift = Math.max(0, ground - y - h);
        const shadow = Math.max(8, Math.round(w * 0.77 - lift / 5));
        rect(ctx, '#865e69', x + Math.floor((w - shadow) / 2), ground, shadow, 1);
        if (!preview && dino.grounded) {
            const kick = Math.floor(distance / 6) % 5;
            rect(ctx, '#cd927e', x - kick * 2, ground - 2 - Math.floor(kick / 2), 2, 1);
        }
        ctx.drawImage(dinoSprite, x, y, w, h);
    };
}
