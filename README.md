# 🎞️ Daily Reel — a journal that animates your day

Write a journal entry and Daily Reel draws it as a **black-and-white doodle**, sentence by sentence and word by word.
Each sentence becomes a panel. As the caption writes out the sentence, each person appears when you name them, the action
starts at its verb, and each object is drawn the moment its noun is written.

## Features

- **Journal**: write, edit, search and delete dated entries. Everything is saved in your browser (`localStorage`). Nothing is uploaded.
- **One panel per sentence, drawn word by word**:
  - **People**: "I", "we", names ("Sarah"), relations ("Mom", "my boss") and pronouns ("she", "they") become labelled characters. The person written before the verb is the one doing it, so "Lily gave me a cake" shows Lily handing it over.
  - **Actions**: about 150 verbs map to around 40 animations, such as walking, running, eating, cooking, dancing, singing, hugging, talking (with speech bubbles), sleeping, reading, driving, swimming, flying, giving, throwing, falling, crying and laughing. A sentence can hold several actions in order ("drove to the beach and swam").
  - **Objects**: about 1,800 nouns are drawn, each labelled with its word. Counts are drawn too: "three cookies" shows three. Animals that start a sentence act out its verb ("My dog chased two birds").
  - **Places**: 22 settings (park, beach, kitchen, office, airport, cinema, stage…). A place is pencilled in faintly and inked when its word is written. Named places ("flew to Rome") get a signpost.
  - **Time and weather**: night, evening and morning skies, plus rain, snow, wind and fog.
  - **Thinking and negation**: "I miss my grandma" puts Grandma in a thought bubble. "I didn't go to the gym" shows the gym crossed out.
- **Black-and-white doodle style**: pen on notebook paper. Light colours become paper, mid tones become hatching, dark ones become solid ink, and emoji are traced into line art. Lines wobble from frame to frame at a hand-drawn frame rate.
- **Live preview**: the doodle updates as you type.
- **Play my reel**: plays all your entries back to back, oldest first.
- **Download video**: records the doodle to a `.webm` file.
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

The text analyzer and the storyboard reader have unit tests (Node 18+):

```bash
node --test tests/*.test.js
```

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | App shell |
| `css/styles.css` | Styles (light and dark mode, responsive) |
| `js/analyzer.js` | Mood and a short title for each entry (used in the entry list) |
| `js/storyboard.js` | Reads each sentence word by word into a panel script: place, people, actions, objects, counts, time, weather |
| `js/lexicon.js` | Word → drawing dictionary, generated from [emojilib](https://github.com/muan/emojilib) (MIT) by `tools/build-lexicon.js` |
| `js/animator.js` | Canvas renderer: characters, places, actions, word-synced caption, doodle style, loop and video recording |
| `js/app.js` | UI, storage, reel playback, export/import |
| `tests/*.test.js` | Unit tests |
| `tools/build-lexicon.js` | Regenerates `js/lexicon.js` from emojilib's `emoji-en-US.json` |

## Ideas for later

- Optionally use an LLM (for example, the Claude API) to read sentences the word lists don't understand.
- Sync across devices with an optional backend.
- Generate weekly or monthly recap reels.
