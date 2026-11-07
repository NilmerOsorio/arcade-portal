# 🕹️ Welcome to Arcade Portal

I built Arcade Portal as a single place to play 11 browser games. Each game has its own page, so you can bookmark a favorite, challenge a friend to Pong, or head back to the library when you feel like trying something different.

## 🎮 Play your first game

1. Download the project. If it comes as a ZIP, extract the whole folder so the games, artwork, and sounds stay together.
2. Open the `index.html` file next to this README in your browser. That opens the game library. You can play without installing any tools.
3. Choose a game title or select **Play Now**. When you’re ready for another round somewhere else, select **← Back to Arcade**.

## Find something to play

The library updates as you type. Search looks at game titles, descriptions, and category tags, so you don’t need to remember the exact name. Try **pipes** to find Flappy Bird, or select **Memory** to see Memory Card Match and Simon Says. You can combine a category with a search. If there are no matches, **Show all games** clears both filters.

If you’d like a surprise, **Random game** opens one of the 11 games in the full library. On a keyboard, press `/` from the library to jump to the search box.

## 🛠️ How the project fits together

I used HTML, CSS, and JavaScript to build the portal. The library handles browsing, while each game manages its own controls, rules, and scoring.

| File or folder | What you’ll find |
| --- | --- |
| `index.html` | The library page, including its search box, category filters, and space for game cards. |
| `script/script.js` | The game catalog, pixel artwork, and code that shows matching cards as you search. |
| `styles/styels.css` | The portal’s neon colors, card effects, and grid that adapts to different screen sizes. |
| `games/` | One folder per game, each with its own page, styles, scripts, and any media it uses. |
| `games/arcade-nav.css` | The shared style for the **Back to Arcade** link. |

If you’re exploring the code, try following one game from its catalog entry to its folder. For example, the Pong entry in `script/script.js` opens `games/pong/index.html`, and `games/pong/js/main.js` handles the match itself.

Pick a game that catches your eye and enjoy a round!
