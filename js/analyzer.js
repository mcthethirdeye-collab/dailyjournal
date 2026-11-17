/*
 * analyzer.js — turns a free-text journal entry into a "story" description
 * that the animator can render: which scene, the main-event sentence, mood,
 * time of day, who was there and which objects were mentioned.
 *
 * Works fully offline with keyword lexicons. Usable in the browser
 * (window.JournalAnalyzer) and in Node (module.exports) for tests.
 */
(function (global) {
  'use strict';

  // ---- Scene lexicon ---------------------------------------------------
  // Each keyword is matched as a word prefix ("run" matches "running").
  // Use a leading "=" for an exact-word match (avoids "art" -> "party").
  const SCENES = {
    birthday:  { label: 'Birthday / Party', icon: '🎂', words: ['birthday', 'cake', 'candle', 'party', 'parties', 'balloon', 'surprise', '=turned'] },
    wedding:   { label: 'Wedding', icon: '💒', words: ['wedding', 'married', 'marry', 'bride', 'groom', 'engaged', 'engagement', 'proposed', 'proposal'] },
    beach:     { label: 'Beach / Sea', icon: '🏖️', words: ['beach', 'ocean', 'sea', 'waves', 'surf', 'swim', 'sand', 'shore', 'seaside', 'pool', 'lake', 'boat', 'sail'] },
    rain:      { label: 'Rainy day', icon: '🌧️', words: ['rain', 'storm', 'thunder', 'drizzle', 'umbrella', 'wet', 'soaked', 'puddle'] },
    snow:      { label: 'Snow / Winter', icon: '☃️', words: ['snow', 'winter', 'ski', 'skiing', 'sled', 'snowman', 'frost', 'freezing', 'ice skat'] },
    work:      { label: 'Work / Office', icon: '💼', words: ['work', 'office', 'meeting', 'boss', 'deadline', 'project', 'presentation', 'client', 'coworker', 'colleague', 'email', 'shift', 'interview', 'job', 'code', 'coding'] },
    study:     { label: 'Study / School', icon: '📚', words: ['study', 'studied', 'exam', 'test', 'class', 'school', 'homework', 'lecture', 'library', 'read', 'book', 'learn', 'university', 'college', 'teacher', 'essay', 'grade'] },
    exercise:  { label: 'Running / Workout', icon: '🏃', words: ['run', 'ran', 'jog', 'gym', 'workout', 'work out', 'exercise', 'marathon', 'yoga', 'lift', 'cardio', 'training', 'sprint', 'race', 'bike ride', 'cycling', 'cycled'] },
    sports:    { label: 'Sports / Game', icon: '⚽', words: ['soccer', 'football', 'basketball', 'tennis', 'baseball', 'match', 'score', 'goal', '=team', 'tournament', 'volleyball', 'hockey', 'golf'] },
    win:       { label: 'Big win', icon: '🏆', words: ['won', 'win', 'promot', 'award', 'trophy', 'champion', 'achiev', 'accepted', 'passed', 'success', 'raise', 'graduat', 'finally did', 'got the job', 'hired', 'offer'] },
    food:      { label: 'Food / Dinner', icon: '🍝', words: ['dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'cook', 'ate', 'eat', 'meal', 'bake', 'baked', 'pizza', 'pasta', 'sushi', 'burger', 'taco', 'delicious', 'recipe', 'cafe', 'coffee'] },
    music:     { label: 'Music / Concert', icon: '🎸', words: ['concert', 'music', 'song', 'sing', 'sang', 'band', 'guitar', 'piano', 'dance', 'danced', 'dancing', 'festival', 'gig', 'karaoke', 'dj'] },
    travel:    { label: 'Travel / Flight', icon: '✈️', words: ['flight', 'flew', 'fly', 'plane', 'airport', 'travel', 'trip', 'vacation', 'holiday', 'abroad', 'hotel', 'passport', 'landed', 'tourist', 'visited'] },
    roadtrip:  { label: 'Driving / Road trip', icon: '🚗', words: ['drive', 'drove', 'driving', 'car', 'road trip', 'highway', 'traffic', 'commute', 'bus', 'train'] },
    love:      { label: 'Love / Date', icon: '❤️', words: ['date', 'kiss', 'love', 'crush', 'romantic', 'girlfriend', 'boyfriend', 'partner', 'wife', 'husband', 'anniversary', 'valentine'] },
    pet:       { label: 'Pets', icon: '🐶', words: ['dog', 'puppy', 'cat', 'kitten', 'pet', 'walked the', 'vet', 'hamster', 'bunny', 'rabbit', 'parrot'] },
    nature:    { label: 'Hike / Nature', icon: '⛰️', words: ['hike', 'hiking', 'hiked', 'mountain', 'trail', 'forest', 'camp', 'park', 'summit', 'climb', 'nature', 'woods', 'picnic', 'garden', 'flowers'] },
    sick:      { label: 'Sick / Doctor', icon: '🤒', words: ['sick', 'ill', 'flu', 'cold', 'fever', 'doctor', 'hospital', 'headache', 'injur', 'hurt', 'pain', 'surgery', 'cough', 'dentist'] },
    rest:      { label: 'Rest / Sleep', icon: '😴', words: ['sleep', 'slept', 'nap', 'rest', 'relax', 'lazy', 'tired', 'bed', 'netflix', 'movie', 'tv', 'chill', 'cozy', 'stayed in', 'stayed home'] },
    friends:   { label: 'Friends / Hangout', icon: '🧑‍🤝‍🧑', words: ['friend', 'hang out', 'hung out', 'hangout', 'catch up', 'caught up', 'reunion', 'visit', 'game night', 'sleepover'] },
    gaming:    { label: 'Gaming', icon: '🎮', words: ['game', 'gaming', 'played', 'playstation', 'xbox', 'nintendo', 'console', 'level', 'boss fight'] },
    shopping:  { label: 'Shopping', icon: '🛍️', words: ['shop', 'shopping', 'mall', 'bought', 'buy', 'store', 'sale', 'market', 'grocer'] },
    everyday:  { label: 'Everyday moment', icon: '✨', words: [] }
  };

  // ---- Mood lexicon ----------------------------------------------------
  const MOODS = {
    joyful:  { icon: '😄', words: ['happy', 'great', 'amazing', 'awesome', 'wonderful', 'fun', 'love', 'loved', 'best', 'glad', 'joy', 'fantastic', 'perfect', 'beautiful', 'laugh', 'smil', 'delight', 'grateful', 'thankful', 'lucky', 'good'] },
    excited: { icon: '🤩', words: ['excit', 'thrill', 'can\'t wait', 'incredible', 'unbelievable', 'finally', 'wow', 'epic', 'pumped', 'ecstatic', 'proud', 'celebrat'] },
    calm:    { icon: '😌', words: ['calm', 'peace', 'relax', 'quiet', 'chill', 'cozy', 'slow', 'gentle', 'content', 'serene', 'nice'] },
    sad:     { icon: '😢', words: ['sad', 'cry', 'cried', 'tears', 'lonely', 'miss', 'lost', 'upset', 'down', 'depress', 'heartbr', 'disappoint', 'hurt', 'sorry', 'grief', 'funeral', 'worst', 'awful', 'terrible', 'bad'] },
    angry:   { icon: '😠', words: ['angry', 'mad', 'furious', 'annoy', 'frustrat', 'hate', 'rage', 'irritat', 'argument', 'argued', 'fight', 'yelled', 'unfair'] },
    anxious: { icon: '😰', words: ['anxious', 'nervous', 'worried', 'worry', 'stress', 'scared', 'afraid', 'panic', 'overwhelm', 'fear', 'tense', 'dread'] },
    tired:   { icon: '🥱', words: ['tired', 'exhaust', 'sleepy', 'drained', 'worn out', 'long day', 'burnt out', 'burned out'] }
  };

  // Big "event" scenes beat everyday backdrops (a promotion at the office is a win, not "work").
  const SCENE_WEIGHT = { win: 1.6, wedding: 1.6, birthday: 1.4, love: 1.2, travel: 1.1, work: 0.85, rest: 0.85, food: 0.9, study: 0.9 };

  const NEGATORS = ['not', "n't", 'never', 'no', 'hardly', 'barely'];
  const FLIP = { joyful: 'sad', excited: 'calm', calm: 'anxious', sad: 'calm', angry: 'calm', anxious: 'calm', tired: 'joyful' };

  // ---- Time of day -----------------------------------------------------
  const TIMES = {
    morning: ['morning', 'sunrise', 'breakfast', 'dawn', 'woke up'],
    day:     ['afternoon', 'noon', 'lunch', 'midday'],
    evening: ['evening', 'sunset', 'dinner', 'dusk', 'after work'],
    night:   ['night', 'midnight', 'stars', 'late', 'moon', 'tonight', 'concert', 'party', 'club', '=bar', '=bed', 'fireworks']
  };

  // ---- People ----------------------------------------------------------
  const PEOPLE = {
    'friend': 'Friend', 'friends': 'Friends', 'mom': 'Mom', 'mum': 'Mum', 'mother': 'Mom', 'dad': 'Dad', 'father': 'Dad',
    'sister': 'Sister', 'brother': 'Brother', 'grandma': 'Grandma', 'grandpa': 'Grandpa', 'girlfriend': 'GF',
    'boyfriend': 'BF', 'wife': 'Wife', 'husband': 'Husband', 'partner': 'Partner', 'kids': 'Kids', 'son': 'Son',
    'daughter': 'Daughter', 'baby': 'Baby', 'boss': 'Boss', 'coworker': 'Coworker', 'coworkers': 'Team',
    'colleague': 'Colleague', 'colleagues': 'Team', 'team': 'Team', 'family': 'Family', 'cousin': 'Cousin',
    'aunt': 'Aunt', 'uncle': 'Uncle', 'roommate': 'Roommate', 'neighbor': 'Neighbor', 'teacher': 'Teacher'
  };
  const PLACE_PREPS = new Set(['to', 'in', 'at', 'the', 'from', 'of', 'near', 'visited', 'into', 'around', 'through', 'across', 'toward', 'towards']);
  const NAME_STOP = new Set(['I', 'The', 'A', 'An', 'It', 'We', 'My', 'Today', 'Yesterday', 'Then', 'After', 'Before',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Christmas', 'Netflix', 'God', 'OK']);

  // ---- Props: objects mentioned -> emoji --------------------------------
  const PROPS = [
    ['coffee', '☕'], ['tea', '🍵'], ['pizza', '🍕'], ['ice cream', '🍦'], ['burger', '🍔'], ['sushi', '🍣'], ['taco', '🌮'],
    ['pasta', '🍝'], ['cake', '🎂'], ['cookie', '🍪'], ['bread', '🍞'], ['donut', '🍩'], ['beer', '🍺'], ['wine', '🍷'],
    ['cocktail', '🍸'], ['popcorn', '🍿'], ['chocolate', '🍫'], ['apple', '🍎'], ['salad', '🥗'], ['ramen', '🍜'],
    ['dog', '🐕'], ['puppy', '🐶'], ['cat', '🐈'], ['kitten', '🐱'], ['bird', '🐦'], ['fish', '🐟'], ['horse', '🐎'],
    ['flower', '🌸'], ['tree', '🌳'], ['sun', '☀️'], ['rainbow', '🌈'], ['book', '📚'], ['phone', '📱'], ['laptop', '💻'],
    ['computer', '🖥️'], ['camera', '📷'], ['photo', '📸'], ['guitar', '🎸'], ['piano', '🎹'], ['headphones', '🎧'],
    ['gift', '🎁'], ['present', '🎁'], ['balloon', '🎈'], ['ring', '💍'], ['money', '💰'], ['paycheck', '💵'],
    ['car', '🚗'], ['bike', '🚲'], ['bicycle', '🚲'], ['train', '🚆'], ['bus', '🚌'], ['plane', '✈️'], ['boat', '⛵'],
    ['ball', '⚽'], ['basketball', '🏀'], ['tennis', '🎾'], ['medal', '🏅'], ['trophy', '🏆'], ['movie', '🎬'],
    ['game', '🎮'], ['baby', '👶'], ['letter', '💌'], ['candle', '🕯️'], ['star', '⭐'], ['heart', '❤️'], ['pill', '💊'],
    ['tent', '⛺'], ['fire', '🔥'], ['snowman', '⛄'], ['umbrella', '☂️'], ['shoes', '👟'], ['dress', '👗'], ['key', '🔑'],
    ['house', '🏠'], ['home', '🏠'], ['email', '📧'], ['clock', '⏰'], ['beach', '🏝️'], ['mountain', '🏔️']
  ];

  const EVENT_WORDS = ['went', 'got', 'met', 'saw', 'visited', 'had', 'won', 'lost', 'finally', 'first time', 'celebrat',
    'surprise', 'happened', 'decided', 'started', 'finished', 'became', 'found', 'made', 'took', 'received', 'learned',
    'today', 'tonight'];
  const INTENSIFIERS = ['best', 'worst', 'amazing', 'never', 'finally', 'huge', 'incredible', 'unbelievable', 'so ', 'really',
    'ever', 'biggest', 'most', 'totally', 'completely', 'absolutely'];

  // ---- helpers ---------------------------------------------------------
  const reCache = new Map();
  function kwRegex(kw) {
    if (reCache.has(kw)) return reCache.get(kw);
    let re;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (kw.startsWith('=')) re = new RegExp('\\b' + esc(kw.slice(1)) + '\\b', 'gi');
    else re = new RegExp('\\b' + esc(kw), 'gi');
    reCache.set(kw, re);
    return re;
  }
  function countMatches(text, words) {
    let n = 0;
    for (const w of words) {
      const m = text.match(kwRegex(w));
      if (m) n += m.length;
    }
    return n;
  }

  function splitSentences(text) {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?…])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function sceneScores(text) {
    const scores = {};
    for (const [id, def] of Object.entries(SCENES)) scores[id] = countMatches(text, def.words);
    return scores;
  }

  function scoreSentence(s, index, total) {
    const lower = s.toLowerCase();
    let score = 0;
    const sc = sceneScores(s);
    score += Math.min(6, Object.values(sc).reduce((a, b) => a + b, 0)) * 2;
    for (const def of Object.values(MOODS)) score += countMatches(lower, def.words) * 1.5;
    score += countMatches(lower, EVENT_WORDS) * 1.5;
    score += countMatches(lower, INTENSIFIERS) * 1;
    score += (s.match(/!/g) || []).length * 1.5;
    const words = s.split(/\s+/).length;
    if (words < 4) score -= 3;
    if (words > 40) score -= 1;
    // small bias toward the start, where people usually state the headline
    score += (1 - index / Math.max(1, total)) * 0.75;
    return score;
  }

  function pickMainSentence(sentences) {
    if (sentences.length === 0) return '';
    let best = 0, bestScore = -Infinity;
    sentences.forEach((s, i) => {
      const sc = scoreSentence(s, i, sentences.length);
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    return sentences[best];
  }

  function detectScene(main, full) {
    const mainS = sceneScores(main);
    const fullS = sceneScores(full);
    // "went to Paris", "flew to Tokyo", "arrived in Rome" -> a trip
    const tripRe = /\b(?:went|flew|travel(?:l)?ed|arrived|drove|took a train|landed)\s+(?:to|in|into)\s+[A-Z]/g;
    mainS.travel += (main.match(tripRe) || []).length;
    fullS.travel += (full.match(tripRe) || []).length;
    let best = 'everyday', bestScore = 0;
    for (const id of Object.keys(SCENES)) {
      const s = (mainS[id] * 3 + fullS[id]) * (SCENE_WEIGHT[id] || 1);
      if (s > bestScore) { bestScore = s; best = id; }
    }
    return best;
  }

  function detectMood(main, full) {
    const tally = {};
    for (const k of Object.keys(MOODS)) tally[k] = 0;
    const scan = (text, weight) => {
      const tokens = text.toLowerCase().split(/\s+/);
      tokens.forEach((tok, i) => {
        for (const [mood, def] of Object.entries(MOODS)) {
          if (def.words.some((w) => !w.includes(' ') && tok.replace(/[^a-z']/g, '').startsWith(w))) {
            const prev = tokens.slice(Math.max(0, i - 3), i).join(' ');
            const negated = NEGATORS.some((n) => prev.includes(n));
            tally[negated ? FLIP[mood] : mood] += weight;
          }
        }
      });
      for (const [mood, def] of Object.entries(MOODS)) {
        for (const w of def.words) if (w.includes(' ') && text.toLowerCase().includes(w)) tally[mood] += weight;
      }
    };
    scan(full, 1);
    scan(main, 2);
    const exclaims = (full.match(/!/g) || []).length;
    tally.excited += Math.min(exclaims, 3) * 0.5;
    let best = 'calm', bestScore = 0;
    for (const [m, v] of Object.entries(tally)) if (v > bestScore) { bestScore = v; best = m; }
    const intensity = Math.max(0.3, Math.min(1, bestScore / 6));
    return { mood: best, intensity };
  }

  function detectTime(main, full, scene) {
    for (const text of [main, full]) {
      const lower = text.toLowerCase();
      let best = null, bestN = 0;
      for (const [t, words] of Object.entries(TIMES)) {
        const n = countMatches(lower, words);
        if (n > bestN) { bestN = n; best = t; }
      }
      if (best) return best;
    }
    if (scene === 'rest' || scene === 'music') return 'night';
    if (scene === 'food') return 'evening';
    return 'day';
  }

  function detectPeople(main, full) {
    const found = [];
    const add = (label) => { if (!found.includes(label) && found.length < 4) found.push(label); };
    for (const text of [main, full]) {
      // Names after "with", "and", "met", "saw", "called", "visited"
      const nameRe = /\b(?:with|and|met|called|texted|hugged|me and|told)\s+([A-Z][a-z]{1,14})\b/g;
      let m;
      while ((m = nameRe.exec(text))) if (!NAME_STOP.has(m[1])) add(m[1]);
      // Any other capitalised word that isn't the first word of a sentence
      for (const sent of splitSentences(text)) {
        const words = sent.split(/\s+/);
        for (let i = 1; i < words.length; i++) {
          const w = words[i].replace(/[^A-Za-z'’]/g, '').replace(/['’]s$/, '');
          if (!/^[A-Z][a-z]{1,14}$/.test(w) || NAME_STOP.has(w) || /[:.]$/.test(words[i - 1])) continue;
          const prev = words[i - 1].toLowerCase().replace(/[^a-z]/g, '');
          const next = (words[i + 1] || '').replace(/[^A-Za-z]/g, '');
          const prevCap = i > 1 && /^[A-Z]/.test(words[i - 1]);
          // Multi-word proper nouns and words after place prepositions are usually places.
          if (PLACE_PREPS.has(prev) || /^[A-Z]/.test(next) || prevCap) continue;
          add(w);
        }
      }
      const lower = text.toLowerCase();
      for (const [w, label] of Object.entries(PEOPLE)) {
        if (new RegExp('\\b' + w + '\\b').test(lower)) add(label);
      }
    }
    return found;
  }

  function detectProps(main, full, scene) {
    const props = [];
    for (const text of [main, full]) {
      const lower = text.toLowerCase();
      for (const [w, emoji] of PROPS) {
        if (props.length >= 4) break;
        if (new RegExp('\\b' + w + 's?\\b').test(lower) && !props.includes(emoji)) props.push(emoji);
      }
    }
    if (props.length === 0 && SCENES[scene]) props.push(SCENES[scene].icon);
    return props;
  }

  function makeCaption(sentence, max = 110) {
    let c = sentence.trim();
    if (c.length > max) c = c.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
    return c;
  }

  function makeTitle(main, scene, mood) {
    const firstWords = main.replace(/[^\w\s'’-]/g, '').split(/\s+/).filter(Boolean);
    const t = firstWords.slice(0, 6).join(' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) + (firstWords.length > 6 ? '…' : '') : SCENES[scene].label;
  }

  function analyze(text) {
    const clean = (text || '').trim();
    const sentences = splitSentences(clean);
    const main = pickMainSentence(sentences) || clean;
    const scene = detectScene(main, clean);
    const { mood, intensity } = detectMood(main, clean);
    const time = detectTime(main, clean, scene);
    const people = detectPeople(main, clean);
    const props = detectProps(main, clean, scene);
    return {
      scene,
      sceneLabel: SCENES[scene].label,
      sceneIcon: SCENES[scene].icon,
      mainEvent: main,
      caption: makeCaption(main),
      title: makeTitle(main, scene, mood),
      mood,
      moodIcon: MOODS[mood].icon,
      intensity,
      time,
      people,
      props,
      sentenceCount: sentences.length
    };
  }

  const api = { analyze, splitSentences, pickMainSentence, SCENES, MOODS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.JournalAnalyzer = api;
})(typeof window !== 'undefined' ? window : globalThis);
