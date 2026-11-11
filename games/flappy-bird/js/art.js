// The playfield and the character picker share these 17 by 12 pixel drawings.
const FlappyArt = (() => {
    const birds = {
        flame: {
            colors: { r: '#b62c55', f: '#ff544b', o: '#ff963f', h: '#ffe16e' },
            rows: [
                '.......##..##....',
                '......#ff##f#....',
                '.....#offfff##...',
                '..#.#offfffwkw#..',
                '.#f#offffrrwkw#..',
                '#offffrrffrwkw###',
                '.#hoffoffffww#hh#',
                '..#offfrrrrrr#o#.',
                '...#rrffooooo##..',
                '....#rrrhhhh#....',
                '.....##oooo#.....',
                '.......####......'
            ],
            wing: ['#oo#..', '#hho#.', '.#off#', '..###.']
        },
        cyber: {
            colors: { b: '#375bad', c: '#44e6eb', h: '#b5fffe', p: '#e76edb' },
            rows: [
                '.....####........',
                '......#hc###.....',
                '....###cccbc##...',
                '...#bbccccbbcc#..',
                '...#ccbbb#####h#.',
                '##.#bbpp#hccch###',
                '#c#bbbbb#ccc###p#',
                '.#hccccbb###b#p#.',
                '..##bbccbbbbc##..',
                '....#bbppchh#....',
                '.....##bbcc#.....',
                '.......####......'
            ],
            wing: ['##cc#.', '.#bhc#', '..#pb#', '...##.']
        },
        penguin: {
            colors: { b: '#263249', s: '#597b9b', i: '#a7d8e5', o: '#ffad54' },
            rows: [
                '.......#####.....',
                '.....##ssbbb#....',
                '....#sbbbbbbb#...',
                '...#sbbbbbwwwb#..',
                '...#bbbbbwwkwb#..',
                '..#bbbbbiwwkw###.',
                '.#bbbbbiwwwww#oo#',
                '##bbbbiwwwwww###.',
                '.#bbbiwwwwwww#...',
                '..##biwwwwww#....',
                '....###iii##o#...',
                '......#oo#..##...'
            ],
            wing: ['.##s#.', '#sbb#.', '#bb#..', '###...']
        },
        emoji: {
            colors: { y: '#ffcf4c', h: '#fff0a8', a: '#eba046', p: '#fd8089' },
            rows: [
                '........###......',
                '......##yh###....',
                '.....#hhyyyyy#...',
                '....#hyyyyhhyy#..',
                '....#yyyyykkky#..',
                '.##.#yyyykyyyk#..',
                '#hy#yyyyyyppy###.',
                '.#yyyyyyyyppy#aa#',
                '..#ayyyyyyyyy###.',
                '...#aaaaayyy#....',
                '....##aaaaa#.....',
                '......#####......'
            ],
            wing: ['..###.', '.#hhy#', '#hyy#.', '.###..']
        }
    };
    const spriteCache = new Map();
    let skyline;

    function rect(ctx, color, x, y, width, height) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    function stamp(ctx, rows, palette, x, y) {
        rows.forEach((row, dy) => {
            for (let dx = 0; dx < row.length; dx++) {
                if (row[dx] !== '.') rect(ctx, palette[row[dx]], x + dx, y + dy, 1, 1);
            }
        });
    }

    function drawBird(ctx, skin, x, y, width, height, pose = 'level') {
        const key = skin + '-' + pose;
        let sprite = spriteCache.get(key);
        if (!sprite) {
            const bird = birds[skin];
            const colors = { '#': '#19162f', k: '#211c37', w: '#fff4df', ...bird.colors };
            sprite = document.createElement('canvas');
            sprite.width = 17;
            sprite.height = 12;
            const pixels = sprite.getContext('2d');
            stamp(pixels, bird.rows, colors, 0, 0);
            const wingY = { up: 3, level: 5, down: 7 }[pose];
            stamp(pixels, bird.wing, colors, 3, wingY);
            spriteCache.set(key, sprite);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, Math.round(x), Math.round(y), width, height);
    }

    function mountain(ctx, width, height, peaks, color) {
        // Sample the ridge one pixel column at a time to keep the slopes stepped.
        let segment = 0;
        for (let x = 0; x < width; x++) {
            while (x / width > peaks[segment + 1][0]) segment++;
            const [left, start] = peaks[segment];
            const [right, end] = peaks[segment + 1];
            const progress = (x / width - left) / (right - left);
            const y = Math.round(height * (start + (end - start) * progress));
            rect(ctx, color, x, y, 1, height - y);
        }
    }

    function paintSky(ctx, w, h) {
        const bands = ['#191937', '#202044', '#27234e', '#302753', '#3e2c61',
            '#50336b', '#653b73', '#814879', '#a85980', '#c96a86', '#ea878e'];
        bands.forEach((color, i) => {
            const top = Math.floor(i * h * 0.78 / bands.length);
            // Cover the low horizon behind the mountains with the last sky color.
            rect(ctx, color, 0, top, w, h - top);
        });
        const stars = [[8, 17], [19, 42], [36, 21], [45, 57], [53, 8], [69, 34], [77, 16],
            [88, 49], [106, 23], [112, 7], [119, 38], [135, 17], [152, 41], [164, 11],
            [177, 23], [186, 51], [192, 7], [24, 68], [94, 65]];
        stars.forEach(([x, y], i) => {
            rect(ctx, i % 3 === 0 ? '#c2b2db' : '#827daa', Math.floor(x * w / 200), y, 1, 1);
        });
        for (const [x, y] of [[25, 28], [96, 37], [179, 68]]) {
            rect(ctx, '#b29dcc', x - 1, y, 3, 1);
            rect(ctx, '#d5c5e3', x, y - 1, 1, 3);
        }

        const cx = Math.round(w * 0.73);
        const cy = Math.round(h * 0.39);
        const radius = Math.round(w * 0.165);
        const sunlight = ['#ffe3a3', '#ffce97', '#ffb08f', '#fc968b', '#ee818a'];
        for (let dy = -radius; dy <= radius; dy++) {
            const strip = (dy + radius) / (2 * radius);
            if (strip > 0.52 && (dy + radius) % 6 < Math.floor(strip * 3)) continue;
            const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
            rect(ctx, sunlight[Math.min(4, Math.floor(strip * 5))], cx - half, cy + dy, half * 2, 1);
        }
        // Narrow cloud banks break across the disc and echo the horizontal sky bands.
        for (const [x, y, length] of [[4, 92, 35], [35, 95, 20], [83, 62, 25], [148, 102, 46], [160, 104, 47]]) {
            rect(ctx, '#815375', x, y, length, 1);
            rect(ctx, '#94617e', x + 4, y - 1, Math.floor(length * 0.6), 1);
        }
        mountain(ctx, w, h, [[0,.66],[.09,.59],[.13,.61],[.24,.50],[.31,.56],[.34,.55],
            [.46,.65],[.57,.53],[.63,.57],[.69,.52],[.79,.61],[.87,.55],[1,.64]], '#68446f');
        mountain(ctx, w, h, [[0,.68],[.13,.60],[.22,.67],[.32,.60],[.38,.62],[.52,.52],
            [.65,.65],[.74,.59],[.83,.66],[.94,.58],[1,.63]], '#4a3865');
        mountain(ctx, w, h, [[0,.72],[.12,.69],[.24,.74],[.39,.65],[.46,.67],[.58,.63],
            [.70,.73],[.78,.69],[.88,.72],[1,.65]], '#383053');
    }

    function paintCity(ctx, w, h) {
        const rooftops = [27, 38, 22, 31, 51, 32, 43, 26, 36, 54, 22];
        for (let x = -3, i = 0; x < w; i++) {
            const height = rooftops[i % rooftops.length] + 14;
            const roof = h - height;
            const width = 8 + i % 4 * 2;
            rect(ctx, '#42365d', x + 3, roof - 3, width - 5, 3);
            rect(ctx, '#42365d', x, roof, width, height);
            for (let y = roof + 4; y < h; y += 5) {
                rect(ctx, '#745777', x + 2, y, width - 4, 1);
            }
            x += width + 2;
        }
        const buildings = [[-7, 16, 47], [12, 13, 35], [30, 20, 56], [52, 11, 24],
            [64, 15, 34], [84, 18, 49], [108, 10, 27], [120, 17, 38], [140, 12, 33],
            [155, 18, 62], [178, 11, 42], [192, 17, 32]];
        buildings.forEach(([x, width, height], i) => {
            const roof = h - height;
            rect(ctx, '#25253f', x, roof, width, height);
            rect(ctx, '#353049', x + width - 4, roof + 1, 4, height - 1);
            rect(ctx, '#302a47', x + 2, roof - 3, width - 6, 3);
            if (i % 3 === 0) {
                rect(ctx, '#342d49', x + 4, roof - 9, 1, 6);
                rect(ctx, '#e795ac', x + 4, roof - 10, 1, 1);
            }
            for (let row = 0; row < height / 5 - 1; row++) {
                for (let col = 0; col < (width - 4) / 4; col++) {
                    const light = (row * 7 + col * 3 + i) % 11;
                    if (light < 6) rect(ctx, ['#b17894', '#6b7592', '#7f6389'][light % 3],
                        x + 2 + col * 4, roof + 3 + row * 5, 2, 1);
                }
            }
            if (i === 2 || i === 9) {
                rect(ctx, '#6e4268', x - 1, roof + 6, 3, 14);
                for (let j = 0; j < 3; j++) rect(ctx, '#da85a5', x, roof + 7 + j * 4, 1, 2);
            }
        });
    }

    function drawBackground(ctx, width, groundY) {
        const w = Math.ceil(width / 2);
        const h = Math.ceil(groundY / 2);
        if (!skyline || skyline.width !== w || skyline.height !== h) {
            skyline = document.createElement('canvas');
            skyline.width = w;
            skyline.height = h;
            const pixels = skyline.getContext('2d');
            paintSky(pixels, w, h);
            paintCity(pixels, w, h);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skyline, 0, 0, width, groundY);
    }

    function drawPipe(ctx, pipe) {
        const x = Math.round(pipe.x);
        const { y, width, height } = pipe;
        const lip = pipe.type === 'top' ? y + height - 16 : y;
        rect(ctx, '#102232', x, y, width, height);
        rect(ctx, '#156267', x + 2, y, width - 4, height);
        rect(ctx, '#2b9390', x + 5, y, 8, height);
        rect(ctx, '#52c8b3', x + 7, y, 2, height);
        rect(ctx, '#227d7c', x + 15, y, 20, height);
        rect(ctx, '#174958', x + width - 11, y, 9, height);
        for (let seam = y + 40; seam < y + height - 5; seam += 56) {
            rect(ctx, '#204e59', x + 2, seam, width - 4, 2);
            rect(ctx, '#66b9a6', x + 6, seam + 2, 8, 1);
            rect(ctx, '#85c7b4', x + width - 7, seam - 3, 2, 2);
        }
        rect(ctx, '#112737', x, lip, width, 16);
        rect(ctx, '#56d4bd', x + 2, lip + 2, width - 4, 12);
        rect(ctx, '#97ead1', x + 4, lip + 2, width - 8, 2);
        rect(ctx, '#279a97', x + 4, lip + 7, width - 8, 5);
        for (const bolt of [6, width - 8]) rect(ctx, '#164958', x + bolt, lip + 8, 2, 2);
    }

    function drawGround(ctx, width, ground, scrollDistance) {
        const y = ground.y;
        const offset = Math.floor(scrollDistance / 2) * 2 % 48;
        rect(ctx, '#131c31', 0, y, width, ground.height);
        rect(ctx, '#acd8e9', 0, y, width, 2);
        rect(ctx, '#5e9dbb', 0, y + 2, width, 3);
        rect(ctx, '#343956', 0, y + 5, width, 12);
        rect(ctx, '#735c8e', 0, y + 9, width, 2);
        rect(ctx, '#252b44', 0, y + 22, width, 42);
        for (let x = -48 - offset; x < width; x += 48) {
            rect(ctx, '#24283d', x, y + 5, 2, 12);
            rect(ctx, '#dda1be', x + 4, y + 9, 8, 2);
            rect(ctx, '#42415c', x + 2, y + 24, 42, 2);
            rect(ctx, '#171d31', x + 44, y + 22, 4, 42);
            for (let step = 0; step < 8; step++) {
                rect(ctx, '#30344e', x + 4 + step * 4, y + 56 - step * 4, 8, 4);
            }
            rect(ctx, '#61617d', x + 4, y + 28, 2, 2);
            rect(ctx, '#373953', x + 4, y + 69, 26, 2);
        }
    }

    return { drawBird, drawBackground, drawPipe, drawGround };
})();
