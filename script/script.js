const games = [
  {
    id: "2048",
    title: "2048 Tile Puzzle",
    tags: ["Puzzle"],
    description: "Slide and merge matching numbered tiles to reach the 2048 tile.",
    icon: "🔢",
  },
  {
    id: "dino-runner",
    title: "Pixel Art Dino Runner",
    tags: ["Action", "Endless"],
    description: "Jump over cacti and obstacles in this pixel-art side-scrolling endless runner.",
    icon: "🦖",
  },
  {
    id: "flappy-bird",
    title: "Flappy Bird Multi-Character",
    tags: ["Arcade", "Action"],
    description: "Navigate through scrolling pipes with selectable bird characters.",
    icon: "🐤",
  },
  {
    id: "memory-card",
    title: "Memory Card Match 3D",
    tags: ["Memory", "Puzzle"],
    description: "Test your visual recall with 3D card flips across multiple grid sizes.",
    icon: "🃏",
  },
  {
    id: "minesweeper",
    title: "Multi-Difficulty Minesweeper",
    tags: ["Logic", "Puzzle"],
    description: "Uncover safe tiles and flag mines with first-click safety across 3 difficulty tiers.",
    icon: "💣",
  },
  {
    id: "pong",
    title: "Retro Arcade Pong",
    tags: ["Sports", "Arcade"],
    description: "Classic 2D paddle sports game supporting 2-player local matches and 3 AI bot levels.",
    icon: "🏓",
  },
  {
    id: "quiz-app",
    title: "Knowledge Quiz & Dashboard",
    tags: ["Quiz", "Trivia"],
    description: "Interactive trivia app featuring score breakdowns and background audio.",
    icon: "💡",
  },
  {
    id: "rps-game",
    title: "Rock Paper Scissors",
    tags: ["Arcade", "Classic"],
    description: "Real-time decision game with choice buttons, computer AI, and winning streaks.",
    icon: "✂️",
  },
  {
    id: "simon-says",
    title: "Simon Says Audio Memory",
    tags: ["Memory", "Rhythm"],
    description: "Pattern-matching memory game with synthesized Web Audio API sound frequencies.",
    icon: "🎵",
  },
  {
    id: "snake",
    title: "Retro Audio Snake",
    tags: ["Arcade", "Classic"],
    description: "Classic grid snake game with custom audio scoring and collision sound effects.",
    icon: "🐍",
  },
  {
    id: "tic-tac-toe",
    title: "Tic Tac Toe Grid",
    tags: ["Strategy", "Logic"],
    description: "Dual-mode 3x3 matrix game supporting Player vs. Player and Player vs. Computer AI.",
    icon: "⭕",
  },
];

const searchInput = document.getElementById("game-search");
const filters = document.getElementById("category-filters");
const grid = document.getElementById("game-grid");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const clearSearch = document.getElementById("clear-search");
let activeCategory = "";

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createCard(game) {
  const path = `games/${game.id}/index.html`;
  const card = makeElement("article", "game-card");
  const art = makeElement("div", `game-art art-${game.id}`);
  art.setAttribute("aria-hidden", "true");
  art.append(makeElement("span", "art-icon", game.icon));
  drawCardArt(art, game.id);

  const content = makeElement("div", "card-content");
  const badges = makeElement("div", "tags");
  for (const tag of game.tags) {
    const badge = makeElement("span", "tag", tag);
    badge.dataset.tag = tag.toLowerCase();
    badges.append(badge);
  }

  const heading = makeElement("h3", "game-title");
  const titleLink = document.createElement("a");
  titleLink.href = path;
  titleLink.textContent = game.title;
  heading.append(titleLink);

  const description = makeElement("p", "game-description", game.description);
  const playLink = makeElement("a", "play-btn", "Play Now");
  playLink.href = path;
  playLink.setAttribute("aria-label", `Play Now, ${game.title}`);

  content.append(badges, heading, description, playLink);
  card.append(art, content);
  return card;
}

// Draw on a small integer grid, then let CSS scale the pixels to the card.
function makePixelPainter(canvas) {
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function background(top, bottom) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, top);
    sky.addColorStop(1, bottom);
    rect(0, 0, canvas.width, canvas.height, sky);
  }

  function grid(color, step = 10) {
    for (let x = 0; x < canvas.width; x += step) rect(x, 0, 1, canvas.height, color);
    for (let y = 0; y < canvas.height; y += step) rect(0, y, canvas.width, 1, color);
  }

  function spark(x, y, size, color) {
    rect(x - size, y, 2 * size + 1, 1, color);
    rect(x, y - size, 1, 2 * size + 1, color);
  }

  function stars(color, offset = 0) {
    for (let i = 0; i < 29; i++) {
      const x = (i * 37 + offset) % canvas.width;
      const y = (i * i * 3 + i * 7 + offset) % 48;
      rect(x, y, i % 6 === 0 ? 2 : 1, 1, color);
    }
  }

  function sprite(x, y, scale, rows, palette) {
    rows.forEach((row, j) => [...row].forEach((key, i) => {
      if (palette[key]) rect(x + i * scale, y + j * scale, scale, scale, palette[key]);
    }));
  }

  // Rasterize polygons on whole pixels so slanted edges have crisp steps.
  function polygon(points, color) {
    const ys = points.map((point) => point[1]);
    for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
      const intersections = [];
      points.forEach(([x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y + 0.5) !== (y2 <= y + 0.5)) {
          intersections.push(x1 + (y + 0.5 - y1) * (x2 - x1) / (y2 - y1));
        }
      });
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        const x = Math.round(intersections[i]);
        rect(x, y, Math.round(intersections[i + 1]) - x, 1, color);
      }
    }
  }

  function glyph(text, x, y, size, color) {
    const shapes = {
      "0": ["111", "101", "101", "101", "111"],
      "1": ["010", "110", "010", "010", "111"],
      "2": ["111", "001", "111", "100", "111"],
      "3": ["111", "001", "011", "001", "111"],
      "4": ["101", "101", "111", "001", "001"],
      "8": ["111", "101", "111", "101", "111"],
      "?": ["111", "001", "011", "000", "010"],
    };
    [...text].forEach((char, i) => sprite(x + i * 4 * size, y, size, shapes[char], {1: color}));
  }

  return { rect, background, grid, spark, stars, sprite, polygon, glyph };
}

const cardIllustrations = {
  "2048"({ background, grid, rect, glyph, spark }) {
    background("#321d3e", "#582f54");
    grid("#66405a", 12);
    function tile(x, y, width, size, digits, sides, face, edge, ink) {
      rect(x - 2, y + 4, width + 4, 29, "#321d34");
      rect(x, y + 2, width, 29, sides);
      rect(x, y, width, 25, face);
      rect(x + 2, y + 1, width - 4, 2, edge);
      rect(x, y + 3, 2, 19, edge);
      const length = (digits.length * 4 - 1) * size;
      glyph(digits, x + Math.floor((width - length) / 2), y + Math.floor((26 - size * 5) / 2), size, ink);
    }
    tile(21, 24, 26, 3, "2", "#a6505a", "#ed916f", "#ffc19a", "#672e42");
    tile(40, 37, 31, 3, "4", "#a85a38", "#f5b261", "#ffdf97", "#723c35");
    tile(113, 5, 33, 3, "8", "#aa4b45", "#f28b59", "#ffc599", "#70323b");
    tile(60, 13, 60, 3, "2048", "#bd672e", "#ffce59", "#fff09d", "#673b32");
    spark(54, 9, 2, "#ffdf8a");
    spark(132, 44, 3, "#ffdf8a");
    spark(15, 47, 1, "#cb8090");
  },

  "dino-runner"({ background, rect, stars, polygon, sprite }) {
    background("#242547", "#8c648e");
    stars("#aba2bd", 15);
    rect(127, 9, 13, 13, "#eab3a0");
    rect(125, 12, 17, 7, "#eab3a0");
    polygon([[0,51],[0,37],[24,22],[42,34],[66,15],[92,37],[118,24],[140,36],[163,18],[180,30],[180,58]], "#5e537a");
    polygon([[0,56],[0,43],[14,35],[32,45],[49,37],[70,50],[99,27],[123,48],[151,32],[180,47],[180,60]], "#413c60");
    rect(0, 57, 180, 2, "#9690a1");
    rect(0, 59, 180, 13, "#36334d");
    for (const x of [4, 17, 29, 61, 83, 103, 129, 158, 172]) rect(x, 63 + x % 4, 5, 1, "#65546d");
    rect(40, 59, 36, 2, "#211f36");
    sprite(33, 6, 3, [
      "............gggggg.", "...........gllllllg", "...........glldlllg",
      "...........gllllllg", "...........gllgggg.", "...........gllll...",
      ".........gggll.....", "..g.....glllll.....", "..lg...gllhhlg.....",
      "..hllggllllllggl...", "...hllllllhlg..g...", "....hhllllllg......",
      ".....hhhhhlg.......", ".......ghllg.......", ".......glg.g.......",
      ".......glg..gg.....", "......gglg.........",
    ], {g:"#244e4c", l:"#8fdb73", h:"#51a76e", d:"#252b3f"});
    sprite(118, 33, 2, [
      "...xx...", "...hl...", "x..hl...", "h..hl..x", "hx.hl..l",
      "hhxhl.xl", ".xhhllxl", "...hlhl.", "...hl...", "...hl...",
      "...hl...", "...xx...",
    ], {x:"#2a534f", h:"#52a479", l:"#a4d382"});
    rect(105, 56, 2, 2, "#b99288");
    rect(75, 55, 4, 1, "#e3c8b1");
  },

  "flappy-bird"({ background, rect, stars, spark, sprite }) {
    background("#3a376a", "#c8889a");
    stars("#d5adc3", 7);
    function cloud(x, y) {
      rect(x, y + 3, 25, 4, "#d9a5b7");
      rect(x + 5, y, 13, 5, "#e9bdca");
      rect(x + 8, y - 2, 7, 3, "#e9bdca");
    }
    cloud(7, 26);
    cloud(94, 12);
    cloud(155, 34);
    for (let i = 0; i < 20; i++) rect(i * 10, 64 - (i * 17) % 9, 8, 18, "#836b92");
    function pipe(x, y, height, upper) {
      rect(x, y, 16, height, "#204858");
      rect(x + 2, y, 3, height, "#a2e68b");
      rect(x + 5, y, 7, height, "#53b77a");
      rect(x + 12, y, 2, height, "#31866d");
      const cap = upper ? y + height - 5 : y;
      rect(x - 2, cap, 20, 6, "#234d54");
      rect(x - 1, cap + 1, 18, 3, "#63c681");
      rect(x, cap + 1, 4, 3, "#b3ed92");
    }
    pipe(33, 48, 24, false);
    pipe(135, 0, 23, true);
    pipe(135, 55, 17, false);
    sprite(63, 20, 3, [
      "......kkk.....", "....kkyyykk...", "...kyyYyywwk..", "..kyYYyywwbwk.",
      "..kyyYYywwbwk.", "kkwwkyyyywwkk.", "kwwwwkyyykooOk", ".kwwkyyykoook.",
      "..kkkyyyykkoOk", "....koookkkkk.", ".....kkk......",
    ], {k:"#493947", y:"#f1b844", Y:"#ffe486", w:"#fff0d2", b:"#40384a", o:"#f17c53", O:"#ffb568"});
    rect(54, 37, 7, 1, "#e2b8bd");
    rect(58, 40, 5, 1, "#f4cfbf");
    spark(105, 36, 2, "#ffdea2");
  },

  "memory-card"({ background, grid, rect, spark, polygon }) {
    background("#312b54", "#564565");
    grid("#594461", 12);
    function card(x, y, face, rim, flipped) {
      rect(x + 3, y + 4, 28, 38, "#2b263e");
      rect(x, y, 28, 38, rim);
      rect(x + 2, y + 2, 24, 34, face);
      rect(x + 4, y + 4, 20, 30, rim);
      rect(x + 5, y + 5, 18, 28, face);
      if (flipped) {
        polygon([[x+14,y+10],[x+21,y+18],[x+14,y+27],[x+7,y+18]], "#ff9aaa");
        polygon([[x+14,y+10],[x+14,y+27],[x+7,y+18]], "#ffc9c7");
      } else {
        for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) rect(x + 7 + i * 5 + (j % 2), y + 8 + j * 6, 2, 2, rim);
      }
    }
    card(33, 21, "#494477", "#9282ce", false);
    card(72, 10, "#783e61", "#ffbfca", true);
    card(110, 21, "#783e61", "#ffbfca", true);
    spark(62, 13, 2, "#facdd4");
    spark(148, 48, 3, "#d8afd0");
  },

  minesweeper({ background, grid, rect, glyph, polygon }) {
    background("#203942", "#3e5963");
    grid("#4b6670", 12);
    function tile(x, y, revealed) {
      rect(x, y, 20, 20, "#293d49");
      rect(x + 1, y + 1, 18, 18, revealed ? "#667c80" : "#92a5a1");
      if (!revealed) {
        rect(x + 1, y + 1, 18, 2, "#d8d9bf");
        rect(x + 1, y + 2, 2, 15, "#c8d1bd");
        rect(x + 4, y + 17, 15, 2, "#566c72");
      }
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) tile(40 + col * 20, 7 + row * 20, col < 2 || (row === 2 && col === 2));
    }
    glyph("1", 48, 13, 2, "#b4e8ed");
    glyph("2", 67, 32, 2, "#c7edb5");
    glyph("1", 88, 52, 2, "#b4e8ed");
    rect(89, 21, 3, 22, "#2b343f");
    rect(84, 42, 13, 3, "#343842");
    polygon([[91,15],[112,21],[91,28]], "#ff7f75");
    polygon([[91,15],[112,21],[91,20]], "#ffc09c");
  },

  pong({ background, rect, polygon, glyph, stars }) {
    background("#22253e", "#393857");
    stars("#827996");
    rect(15, 11, 150, 52, "#1a2237");
    rect(17, 13, 146, 1, "#5e607d");
    rect(17, 60, 146, 1, "#5e607d");
    for (let y = 15; y < 60; y += 7) rect(89, y, 2, 3, "#625d80");
    glyph("2", 66, 19, 2, "#8478a4");
    glyph("3", 108, 19, 2, "#8478a4");
    rect(35, 24, 5, 20, "#409f9d");
    rect(35, 24, 2, 20, "#a4ffe3");
    rect(141, 38, 5, 19, "#bd658c");
    rect(144, 38, 2, 19, "#ffc0d9");
    polygon([[74,47],[104,33],[105,36]], "#56738d");
    rect(100, 34, 4, 3, "#a1cdd4");
    rect(106, 31, 5, 5, "#fff5cf");
  },

  "quiz-app"({ background, stars, polygon, rect, spark, glyph }) {
    background("#47304e", "#875367");
    stars("#bc899a", 21);
    const cube = [[54,25],[84,11],[113,24],[83,39]];
    polygon(cube, "#ffdb83");
    polygon([[54,25],[83,39],[83,63],[54,48]], "#e29558");
    polygon([[83,39],[113,24],[113,48],[83,63]], "#bc6b53");
    polygon([[54,25],[83,39],[83,42],[54,28]], "#f0ae67");
    glyph("?", 64, 33, 3, "#74444e");
    glyph("?", 92, 34, 2, "#ffdb99");
    for (const [x, y] of [[29,28],[129,33],[124,43]]) {
      rect(x, y, 19, 4, "#915e76");
      rect(x, y, 3, 4, "#e7aa91");
      rect(x + 5, y + 1, 10, 1, "#c99195");
    }
    spark(105, 11, 2, "#ffe5ae");
    spark(44, 48, 3, "#f8be9d");
  },

  "rps-game"({ background, grid, rect, polygon, sprite }) {
    background("#293452", "#504464");
    grid("#4e4767", 12);
    // Each choice has its own platform and palette.
    for (const x of [28, 74, 120]) {
      rect(x - 3, 52, 36, 4, "#252940");
      rect(x, 51, 30, 2, "#9481a1");
    }
    polygon([[27,39],[31,27],[43,21],[53,28],[59,40],[51,47],[33,47]], "#667290");
    polygon([[27,39],[31,27],[43,21],[48,28],[39,37]], "#b7b3be");
    polygon([[39,37],[48,28],[53,28],[59,40],[51,47]], "#8992a5");
    polygon([[76,19],[94,19],[104,29],[104,46],[76,46]], "#ffe3b3");
    polygon([[94,19],[104,29],[94,29]], "#dcad94");
    for (const y of [32,36,40]) rect(81, y, 16, 1, "#c69393");
    sprite(119, 18, 2, [
      "bb..........b", ".bb........bb", "..bb......bb.", "...bs....sb..", "....bs..sb...",
      ".....bssb....", "......vv.....", "....rr..rr...", "...r..r.r.r..",
      "...r..r.r.r..", "....rr..rr...",
    ], {b:"#b3ccd8", s:"#f2e6d8", v:"#6d687e", r:"#ff9a9e"});
  },

  "simon-says"({ background, stars, rect, spark }) {
    background("#282741", "#49384e");
    stars("#987888", 31);
    const colors = ["#79d4a6", "#ee9296", "#ebbe68", "#8ea9ed"];
    const edges = ["#a9efd1", "#ffbfbb", "#ffe4a2", "#c3d3ff"];
    // Four stepped sectors form a physical Simon pad.
    for (let y = -26; y <= 26; y++) for (let x = -26; x <= 26; x++) {
      const r = x * x + y * y;
      if (r > 676) continue;
      const sector = (y > 0 ? 2 : 0) + (x > 0 ? 1 : 0);
      let color = "#272533";
      if (r > 100 && r < 570 && Math.abs(x) > 1 && Math.abs(y) > 1) {
        color = r > 490 && y < 0 ? edges[sector] : colors[sector];
      }
      rect(90 + x, 36 + y, 1, 1, color);
    }
    rect(84, 35, 12, 2, "#b3a5ad");
    for (const x of [38,43,48,53,120,125,130,135]) {
      const height = 4 + (x * 3) % 12;
      rect(x, 36 - Math.floor(height / 2), 2, height, "#a88298");
    }
    spark(114, 12, 2, "#eed2a6");
  },

  snake({ background, grid, rect, sprite }) {
    background("#233c40", "#34534e");
    grid("#425e58", 8);
    const segments = [[4,5],[5,5],[6,5],[7,5],[7,4],[7,3],[8,3],[9,3],[10,3],[11,3],[11,4],[11,5],[12,5],[13,5],[14,5]];
    for (const [col, row] of segments) {
      const x = col * 8 + 1;
      const y = row * 8 + 1;
      rect(x, y + 1, 8, 8, "#25423a");
      rect(x, y, 8, 7, "#88c775");
      rect(x + 1, y, 6, 2, "#bedf87");
    }
    rect(117, 40, 7, 7, "#b2d97b");
    rect(120, 40, 2, 2, "#283c3e");
    rect(124, 43, 3, 1, "#f89691");
    sprite(133, 32, 2, [
      "...gg.", "..g...", ".rr.rr", "rprrrr", "rprrrr", ".rrrr.", "..rr..",
    ], {g:"#acdb8a", r:"#ef8179", p:"#ffcbad"});
  },

  "tic-tac-toe"({ background, grid, rect, sprite, spark }) {
    background("#2a3552", "#544663");
    grid("#514b68", 12);
    rect(58, 6, 63, 61, "#302e47");
    for (const x of [80,100]) rect(x, 9, 2, 54, "#8d839e");
    for (const y of [26,45]) rect(61, y, 57, 2, "#8d839e");
    const xMark = ["11..11", ".1111.", "..11..", "..11..", ".1111.", "11..11"];
    const oMark = [".1111.", "11..11", "1....1", "1....1", "11..11", ".1111."];
    for (const [col, row, mark] of [[0,0,1],[1,0,0],[2,0,1],[0,1,0],[1,1,1],[1,2,0],[2,2,1]]) {
      sprite(65 + col * 20, 12 + row * 19, 2, mark ? xMark : oMark, {1:mark ? "#fba3b0" : "#9de2db"});
    }
    spark(44, 22, 2, "#b1a0bf");
    spark(136, 44, 3, "#baafca");
  },
};

function drawCardArt(container, id) {
  const draw = cardIllustrations[id];
  if (!draw) return;
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 72;
  const painter = makePixelPainter(canvas);
  if (!painter) return;
  draw(painter);
  canvas.setAttribute("aria-hidden", "true");
  container.replaceChildren(canvas);
}

const cards = games.map((game) => {
  const card = createCard(game);
  grid.append(card);
  const searchText = [game.title, game.description, ...game.tags].join(" ").toLowerCase();
  return { card, tags: game.tags, searchText };
});

function updateResults() {
  const terms = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const { card, tags, searchText } of cards) {
    const matches = (!activeCategory || tags.includes(activeCategory))
      && terms.every((term) => searchText.includes(term));
    card.hidden = !matches;
    if (matches) count += 1;
  }
  emptyState.hidden = count > 0;
  resultCount.textContent = `${count} ${count === 1 ? "game" : "games"}`;
  if (clearSearch) clearSearch.hidden = searchInput.value.length === 0;
}

const categories = [...new Set(games.flatMap((game) => game.tags))].sort();
for (const category of ["", ...categories]) {
  const button = makeElement("button", "filter-btn", category || "All games");
  button.type = "button";
  button.dataset.category = category;
  button.setAttribute("aria-pressed", String(category === activeCategory));
  filters.append(button);
}

function selectCategory(category) {
  activeCategory = category;
  for (const button of filters.querySelectorAll(".filter-btn")) {
    button.setAttribute("aria-pressed", String(button.dataset.category === category));
  }
  updateResults();
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-btn");
  if (button) selectCategory(button.dataset.category);
});

searchInput.addEventListener("input", updateResults);
clearSearch?.addEventListener("click", () => {
  searchInput.value = "";
  updateResults();
  searchInput.focus();
});
document.getElementById("reset-filters").addEventListener("click", () => {
  searchInput.value = "";
  selectCategory("");
  searchInput.focus();
});
document.getElementById("random-game").addEventListener("click", () => {
  const game = games[Math.floor(Math.random() * games.length)];
  window.location.assign(`games/${game.id}/index.html`);
});

updateResults();

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest("input, textarea, [contenteditable]")) return;
  event.preventDefault();
  searchInput.focus();
});

// Paint the hero once at arcade resolution. CSS scales the pixels with the banner.
function drawHero(canvas) {
  const painter = makePixelPainter(canvas);
  if (!painter) return;
  const { background, rect, polygon, sprite, spark } = painter;
  const width = canvas.width;
  const horizon = 116;
  background("#1d173b", "#9b5083");

  // The sunset changes color in horizontal bands, like a limited-palette sky.
  for (let y = -30; y <= 30; y++) {
    if (y > 6 && y % 6 < 2) continue;
    const half = Math.floor(Math.sqrt(900 - y * y));
    const color = y < -15 ? "#ffcfad" : y < -3 ? "#ffb49f" : y < 10 ? "#fb929e" : "#ef7ca2";
    rect(171 - half, 67 + y, half * 2, 1, color);
  }
  for (let i = 0; i < 106; i++) {
    const x = (89 * i + 9 * i * i) % width;
    const y = (47 * i + 13) % 85;
    if ((x - 171) ** 2 + (y - 67) ** 2 > 960) rect(x, y, 1, 1, i % 3 ? "#8d729f" : "#ddbbdf");
  }
  spark(115, 24, 2, "#f0c6fc");
  spark(287, 32, 2, "#baa7fe");
  spark(58, 48, 1, "#dba7d1");
  rect(124, 44, 14, 1, "#ad739d");
  rect(130, 43, 18, 1, "#af749f");
  rect(282, 62, 30, 1, "#bb80ad");

  const peaks = [[0, 96], [24, 82], [40, 91], [70, 65], [94, 86], [120, 72], [145, 92],
    [165, 77], [191, 91], [222, 68], [252, 87], [282, 55], [304, 78], [328, 68]];
  polygon([...peaks, [328, 120], [0, 120]], "#634574");
  for (let i = 1; i < peaks.length - 1; i++) {
    const [x,y] = peaks[i];
    const [nextX,nextY] = peaks[i + 1];
    if (nextY > y) polygon([[x, y], [nextX, nextY], [x + 5, y + 12], [x + 7, y + 16]], "#805680");
  }
  polygon([[0, 98], [26, 83], [45, 100], [67, 89], [93, 101], [116, 83], [146, 104],
    [164, 96], [186, 107], [211, 91], [244, 101], [267, 83], [289, 97], [320, 80], [320, 118], [0, 118]], "#423353");

  // A distant skyline and a perspective grid recede behind the cabinet.
  for (let i = 0; i < 42; i++) {
    const x = i * 8 - 2;
    const height = 5 + (i * 13 + i * i * 3) % 19;
    const top = horizon - height;
    rect(x, top, 6 + i % 4, height, "#302c47");
    if (i % 4 === 1) rect(x + 2, top - 3, 3, 4, "#302c47");
    for (let y = top + 3; y < horizon - 1; y += 4) {
      if ((i + y) % 3) rect(x + 2, y, 1 + i % 2, 1, "#886387");
    }
  }
  rect(0, horizon, width, 40, "#242039");
  for (const y of [116, 118, 121, 126, 133, 144, 155]) rect(0, y, width, 1, "#483254");
  for (let x = -320; x <= 640; x += 40) {
    const top = 158 + (x - 158) * .08;
    polygon([[top, 116], [Math.round(x + 2), 156], [x, 156]], "#51345c");
  }
  polygon([[155,141],[209,129],[286,138],[286,141],[221,150],[155,146]], "#1c192d");

  // Three-quarter cabinet: violet side panel, lit marquee, recessed CRT, controls.
  polygon([[176,15],[228,12],[261,23],[261,129],[249,140],[223,145],[171,140],[169,94],
    [178,84],[182,59],[175,53],[172,29]], "#171528");
  polygon([[227,15],[258,25],[258,128],[249,136],[225,141],[221,93],[225,83],[224,61],[229,50]], "#5b3680");
  polygon([[232,23],[253,30],[253,125],[230,135],[228,95],[233,79],[231,56],[235,47]], "#412a65");
  polygon([[241,26],[255,31],[255,126],[251,129],[252,33]], "#9860a5");
  polygon([[230,82],[252,63],[252,70],[233,89],[242,87],[231,104],[247,88],[252,88],[230,113]], "#db7bc4");
  polygon([[233,90],[252,74],[252,80],[236,94]], "#fbabcf");
  polygon([[233,114],[252,95],[252,99],[234,119]], "#78b7dc");
  polygon([[228,135],[254,125],[254,128],[229,139]], "#b05caa");

  polygon([[175,16],[226,13],[232,17],[180,21]], "#dda7e2");
  polygon([[174,19],[225,16],[229,49],[179,53]], "#9364af");
  polygon([[176,21],[222,18],[224,45],[180,48]], "#281d43");
  polygon([[178,24],[220,21],[222,38],[179,42]], "#c38bc7");
  polygon([[179,25],[219,22],[220,37],[180,40]], "#5b3e79");
  // The marquee lettering is built from the same square pixels as the scene.
  const marquee = {
    A: ["0110","1001","1111","1001","1001"], R: ["1110","1001","1110","1010","1001"],
    C: ["0111","1000","1000","1000","0111"], D: ["1110","1001","1001","1001","1110"],
    E: ["1111","1000","1110","1000","1111"],
  };
  [..."ARCADE"].forEach((letter, i) => sprite(184 + i * 5, 29 - Math.floor(i / 2), 1, marquee[letter], {1:"#fff5d3"}));
  polygon([[179,44],[225,40],[226,44],[180,48]], "#d197ca");
  polygon([[181,52],[227,48],[223,79],[179,83]], "#291d41");
  polygon([[185,54],[222,51],[218,76],[182,79]], "#63a5bb");
  polygon([[186,55],[220,53],[217,75],[184,77]], "#142d49");
  polygon([[187,57],[218,55],[215,73],[185,75]], "#22475c");
  for (let y = 58; y < 73; y += 3) rect(188, y, 27, 1, "#284e62");
  const alien = ["01010", "11111", "10101", "11111", "10001"];
  for (let i = 0; i < 3; i++) sprite(191 + i * 7, 59 - (i % 2), 1, alien, {1:"#acddd1"});
  rect(202, 68, 1, 2, "#f6d299");
  rect(199, 72, 6, 1, "#a8d9ec");
  rect(201, 70, 2, 2, "#d5e7f2");
  polygon([[178,83],[223,79],[230,88],[173,94]], "#9868a8");
  polygon([[177,85],[220,81],[225,86],[176,91]], "#523764");
  rect(184, 82, 2, 5, "#27223f");
  rect(182, 79, 6, 4, "#da7998");
  rect(183, 79, 3, 1, "#ffbad1");
  rect(205, 85, 4, 2, "#ffa4be");
  rect(212, 84, 3, 2, "#7cd9d9");
  polygon([[171,94],[229,88],[228,95],[174,101]], "#c88ec4");
  polygon([[174,101],[226,96],[226,140],[177,137]], "#443051");
  polygon([[178,103],[222,99],[221,134],[181,132]], "#372940");
  polygon([[179,125],[220,121],[221,124],[179,129]], "#69436f");
  polygon([[180,130],[220,126],[221,128],[181,132]], "#946592");
  rect(193,104,12,9,"#1d1b2c");
  rect(194,105,10,1,"#826180");
  rect(197,107,4,1,"#f8b9b1");
  rect(197,110,4,1,"#544257");
  polygon([[175,137],[225,140],[225,143],[175,140]], "#78587e");
}

drawHero(document.getElementById("hero-art"));
