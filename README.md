# 🎞️ Daily Reel — a journal that animates your day

Write a journal entry and Daily Reel finds the **main event** of your day and turns it into a short,
looping **mini animation**: a cartoon you, the people you were with, the place, the weather, and your mood.

## Features

- **Journal**: write, edit, search and delete dated entries. Everything is saved in your browser (`localStorage`). Nothing is uploaded.
- **Main-event detection**: each sentence is scored on event words ("finally", "won", "met"…), emotion, intensity and exclamation marks. The strongest one becomes the headline and the caption.
- **23 animated scenes**: birthday/party, wedding, beach, rain, snow, work, study, running, sports, big win,
  food, concert, travel, road trip, love/date, pets, hiking, sick day, rest/sleep, friends, gaming, shopping, everyday.
- **Smart details**:
  - **Mood** sets your character's face (😄 🤩 😌 😢 😠 😰 🥱) and tints the scene. It handles negation like "not happy".
  - **Time of day** sets the sky: morning, day, evening or night.
  - **People** you mention (names like "Sarah", or "Mom", "friends", "boss") appear as labelled characters.
  - **Objects** (coffee, pizza, dog, guitar…) show up as props.
- **Live preview**: the animation updates as you type. Use the **Scene** menu to override the detected scene.
- **Play my reel**: plays all your entries back to back, oldest first.
- **Download video**: records the animation to a `.webm` file.
- **Backup**: export or import your entries as JSON from the ⋯ menu.

## Run it

There's nothing to install or build. Open `index.html` in a browser:

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then visit http://localhost:8000
```

Opening `index.html` directly with `file://` also works.

## Tests

The text analyzer has unit tests (Node 18+):

```bash
node --test tests/*.test.js
```

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | App shell |
| `css/styles.css` | Styles (light and dark mode, responsive) |
| `js/analyzer.js` | Turns entry text into a story: scene, main event, mood, time, people, props |
| `js/animator.js` | Canvas renderer: character, 23 scenes, caption, loop and video recording |
| `js/app.js` | UI, storage, reel playback, export/import |
| `tests/analyzer.test.js` | Analyzer unit tests |

## Ideas for later

- Use an LLM (for example, the Claude API) to summarise the main event when the keyword analyzer isn't sure.
- Sync across devices with an optional backend.
- Generate weekly or monthly recap reels.
