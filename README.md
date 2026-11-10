# 🕹️ Welcome to the Master Arcade Hub

I built Arcade Portal as a searchable home for 11 browser games. You can look up an old favorite by name, browse by genre, or let **Random game** pick your next round. Each game has its own page, so you can bookmark it or share it with a friend.

## 🚀 Live Demos

- ☁️ Cloudflare Pages: https://arcade-portal.pixelpulsearcade.workers.dev/
- 🐙 GitHub Pages: https://nilmerosorio.github.io/arcade-portal/

To play locally, download and extract the project, then open the root `index.html` in your browser.

## ✨ Features

- 🔍 **Real-time search.** Search titles, descriptions, and tags as you type. Try **pipes** to find Flappy Bird, or combine a search with a category like **Puzzle**.
- 🎮 **Game catalog.** Each card has pixel artwork, a short description, genre tags, and a **Play Now** link.
- 📱 **Responsive layout.** The CSS grid fits the neon game cards into columns on desktop and a single column on narrow phones.
- ↩️ **Back to the hub.** Select **← Back to Arcade** from any game to return to the library and choose another.

## 👾 Included Games

- **2048** — Slide matching tiles together to reach 2048.
- **Dino Runner** — Jump over cacti and keep the run going.
- **Flappy Bird** — Pick a bird and fly through gaps in the pipes.
- **Memory Card** — Flip cards and remember where their partners are.
- **Minesweeper** — Read the clues to uncover safe tiles and flag mines.
- **Pong** — Rally against a friend or a computer opponent.
- **Quiz App** — Answer trivia questions and review your score.
- **Rock Paper Scissors (RPS)** — Choose your move and build a winning streak.
- **Simon Says** — Repeat a growing sequence of lights and sounds.
- **Snake** — Collect food and steer clear of collisions as your snake grows.
- **Tic Tac Toe** — Get three in a row against a friend or the computer.

## 🗂️ Project Structure

```text
Arcade-Portal/
├── README.md
├── index.html             # Hub and game library
├── script/
│   └── script.js          # Game catalog, card rendering, and search
├── styles/
│   └── styels.css         # Portal theme and responsive grid
└── games/
    ├── arcade-nav.css     # Shared return-link styling
    ├── 2048/
    ├── dino-runner/
    ├── flappy-bird/
    ├── memory-card/
    ├── minesweeper/
    ├── pong/
    ├── quiz-app/
    ├── rps-game/
    ├── simon-says/
    ├── snake/
    └── tic-tac-toe/
```

Each game folder contains its own `index.html`, styles, and JavaScript. For example, `games/pong/` holds the court and match logic, while the root portal handles finding and launching Pong.

## 🛠️ How the project fits together

I used HTML, CSS, and JavaScript to build the portal. The library handles browsing, while each game manages its own controls, rules, and scoring.

| File or folder | What you’ll find |
| --- | --- |
| `index.html` | The library page, including its search box, category filters, and space for game cards. |
| `script/script.js` | The game catalog, pixel artwork, and code that shows matching cards as you search. |
| `styles/styels.css` | The portal’s neon colors, card effects, and grid that adapts to different screen sizes. |
| `games/` | One folder per game, each with its own page, styles, scripts, and any media it uses. |
| `games/arcade-nav.css` | The shared style for the **Back to Arcade** link. |

Pick a game, play a round, and explore its folder if you’re curious how it works!
