// Builds js/lexicon.js — a word -> emoji map used to draw the nouns in a journal entry.
// Source data: emojilib (MIT, https://github.com/muan/emojilib), dist/emoji-en-US.json.
// Usage: node tools/build-lexicon.js path/to/emoji-en-US.json
const fs = require('fs');
const path = require('path');
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Skip things that don't make sense as a drawn object.
const skipRanges = [
  [0x1F600, 0x1F64F], [0x1F910, 0x1F92F], [0x1F970, 0x1F97A], [0x1F9D0, 0x1F9DF], // faces, people
  [0x1F466, 0x1F487], [0x1F44A, 0x1F450], [0x1F590, 0x1F596], [0x270A, 0x270D], [0x1F918, 0x1F91F], // hands, people
  [0x1F1E6, 0x1F1FF], // flags
  [0x2190, 0x21FF], [0x2B05, 0x2B07], [0x25AA, 0x25FE], [0x1F500, 0x1F53D], [0x2648, 0x2653], // arrows, shapes, symbols
  [0x1F170, 0x1F251], [0x3030, 0x3299], [0x1F3FB, 0x1F3FF], [0x1F9B0, 0x1F9B3], [0x1F4A0, 0x1F4AF]
];
const STOP = new Set(['food', 'animal', 'nature', 'object', 'face', 'person', 'human', 'thing', 'good', 'bad', 'happy', 'sad',
  'fun', 'love', 'party', 'time', 'day', 'night', 'home', 'work', 'man', 'woman', 'boy', 'girl', 'people', 'family', 'friend',
  'me', 'i', 'you', 'we', 'it', 'a', 'the', 'and', 'of', 'to', 'in', 'on', 'with', 'for', 'at', 'my', 'is', 'go', 'get',
  'make', 'have', 'like', 'new', 'old', 'big', 'small', 'hot', 'cold', 'top', 'up', 'down', 'out', 'over', 'off', 'yes', 'no',
  'one', 'two', 'three', 'four', 'five', 'red', 'blue', 'green', 'yellow', 'white', 'black', 'orange', 'purple', 'brown',
  'pink', 'place', 'location', 'symbol', 'sign', 'mark', 'button', 'light', 'japanese', 'chinese', 'english', 'italy',
  'mexican', 'american', 'america', 'usa', 'sport', 'sports', 'game', 'play', 'travel', 'vacation', 'transportation',
  'vehicle', 'tool', 'office', 'business', 'school', 'education', 'music', 'instrument', 'drink', 'beverage', 'fruit',
  'vegetable', 'sweet', 'dessert', 'snack', 'meal', 'kitchen', 'cooking', 'cook', 'weather', 'sky', 'outdoor', 'space',
  'celebration', 'holiday', 'gift', 'present', 'paper', 'documents', 'documents', 'tech', 'technology', 'clothes', 'fashion',
  'wear', 'accessory', 'body', 'part', 'organism', 'creature', 'pet', 'bird', 'fish', 'bug', 'insect', 'plant', 'flower']);
// A few words people write that should point at a specific drawing.
const OVERRIDE = {
  dog: '🐕', puppy: '🐶', cat: '🐈', kitten: '🐱', bird: '🐦', fish: '🐟', flower: '🌸', flowers: '💐', plant: '🪴',
  coffee: '☕', tea: '🍵', gift: '🎁', present: '🎁', phone: '📱', computer: '💻', laptop: '💻', tv: '📺', television: '📺',
  movie: '🎬', film: '🎬', book: '📖', books: '📚', car: '🚗', bike: '🚲', bus: '🚌', train: '🚆', plane: '✈️', boat: '⛵',
  ball: '⚽', football: '🏈', soccer: '⚽', basketball: '🏀', music: '🎵', song: '🎵', money: '💵', letter: '✉️',
  mail: '✉️', email: '📧', cake: '🎂', pizza: '🍕', burger: '🍔', sandwich: '🥪', salad: '🥗', soup: '🍲', ice: '🧊',
  icecream: '🍦', wine: '🍷', beer: '🍺', water: '💧', rain: '🌧️', snow: '❄️', sun: '☀️', moon: '🌙', star: '⭐',
  stars: '✨', tree: '🌳', trees: '🌳', heart: '❤️', candle: '🕯️', key: '🔑', keys: '🔑', bag: '👜', shoes: '👟',
  shirt: '👕', dress: '👗', hat: '🎩', glasses: '👓', umbrella: '☂️', house: '🏠', game: '🎮', games: '🎮', guitar: '🎸',
  piano: '🎹', drum: '🥁', camera: '📷', photo: '📸', picture: '🖼️', painting: '🖼️', bed: '🛏️', couch: '🛋️', sofa: '🛋️',
  chair: '🪑', door: '🚪', clock: '⏰', baby: '👶', ring: '💍', medal: '🏅', trophy: '🏆', balloon: '🎈', balloons: '🎈',
  fire: '🔥', campfire: '🔥', tent: '⛺', mountain: '⛰️', beach: '🏖️', wave: '🌊', waves: '🌊', ocean: '🌊', sea: '🌊',
  pool: '🏊', medicine: '💊', pill: '💊', pills: '💊', doctor: '🩺', ticket: '🎟️', tickets: '🎟️', bread: '🍞',
  egg: '🥚', eggs: '🍳', breakfast: '🍳', pancake: '🥞', pancakes: '🥞', cookie: '🍪', cookies: '🍪', chocolate: '🍫',
  candy: '🍬', popcorn: '🍿', fries: '🍟', chicken: '🍗', steak: '🥩', noodles: '🍜', ramen: '🍜', rice: '🍚',
  apple: '🍎', banana: '🍌', orange: '🍊', strawberry: '🍓', grapes: '🍇', lemon: '🍋', milk: '🥛', juice: '🧃',
  smoothie: '🥤', soda: '🥤', cup: '🥤', bottle: '🍾', champagne: '🍾', cocktail: '🍸', donut: '🍩', pie: '🥧',
  cupcake: '🧁', taco: '🌮', burrito: '🌯', sushi: '🍣', dumplings: '🥟', pasta: '🍝', spaghetti: '🍝', cheese: '🧀',
  kite: '🪁', rainbow: '🌈', cloud: '☁️', clouds: '☁️', lightning: '⚡', storm: '⛈️', wind: '🌬️', leaf: '🍂', leaves: '🍂',
  rose: '🌹', roses: '🌹', sunflower: '🌻', cactus: '🌵', mushroom: '🍄', horse: '🐎', cow: '🐄', pig: '🐖', sheep: '🐑',
  duck: '🦆', chicken_animal: '🐔', rabbit: '🐇', bunny: '🐰', mouse: '🐭', bear: '🐻', lion: '🦁', tiger: '🐅',
  elephant: '🐘', monkey: '🐒', butterfly: '🦋', bee: '🐝', spider: '🕷️', snake: '🐍', turtle: '🐢', frog: '🐸',
  dolphin: '🐬', whale: '🐳', shark: '🦈', owl: '🦉', penguin: '🐧', hamster: '🐹', parrot: '🦜', duckling: '🐤',
  pen: '🖊️', pencil: '✏️', notebook: '📓', journal: '📓', newspaper: '📰', backpack: '🎒', suitcase: '🧳',
  luggage: '🧳', map: '🗺️', passport: '🛂', headphones: '🎧', microphone: '🎤', mic: '🎤', violin: '🎻',
  trumpet: '🎺', saxophone: '🎷', candles: '🕯️', lamp: '💡', bulb: '💡', idea: '💡', toothbrush: '🪥', soap: '🧼',
  broom: '🧹', bucket: '🪣', hammer: '🔨', scissors: '✂️', needle: '🪡', yarn: '🧶', teddy: '🧸', toy: '🧸',
  doll: '🪆', puzzle: '🧩', dice: '🎲', cards: '🃏', chess: '♟️', bowling: '🎳', skateboard: '🛹', ski: '🎿',
  skis: '🎿', sled: '🛷', snowman: '⛄', surfboard: '🏄', bicycle: '🚲', motorcycle: '🏍️', scooter: '🛴', taxi: '🚕',
  truck: '🚚', ambulance: '🚑', rocket: '🚀', helicopter: '🚁', ship: '🚢', anchor: '⚓', fireworks: '🎆',
  sparkler: '🎇', crown: '👑', lipstick: '💄', perfume: '🧴', watch: '⌚', wallet: '👛', purse: '👛', glove: '🧤',
  gloves: '🧤', scarf: '🧣', socks: '🧦', jacket: '🧥', coat: '🧥', jeans: '👖', boots: '👢', sneakers: '👟',
  syringe: '💉', vaccine: '💉', thermometer: '🌡️', bandage: '🩹', tooth: '🦷', brain: '🧠', bone: '🦴',
  calendar: '📅', envelope: '✉️', package: '📦', box: '📦', trash: '🗑️', globe: '🌍', world: '🌍', earth: '🌍',
  cereal: '🥣', oatmeal: '🥣', license: '🪪', band: '🎸', cereal_bowl: '🥣', church: '⛪', castle: '🏰', stadium: '🏟️', bridge: '🌉', tower: '🗼', statue: '🗽', fountain: '⛲'
};

// Secondary keywords are loose ("license" -> ©, "driving" -> 🚦). Keep only ones that look like concrete nouns.
const ABSTRACT = new Set(['license', 'test', 'driving', 'early', 'late', 'evening', 'morning', 'date', 'fall', 'first', 'fast', 'fresh',
  'cool', 'awesome', 'calm', 'care', 'chill', 'clean', 'create', 'cut', 'dance', 'design', 'draw', 'eat', 'event', 'exam', 'fail',
  'favorite', 'fix', 'forever', 'future', 'gamble', 'agree', 'answer', 'abandon', 'alert', 'alphabet', 'ancient', 'army', 'arrest',
  'art', 'assist', 'attraction', 'award', 'backward', 'balance', 'bet', 'blind', 'blues', 'blurry', 'blush', 'boom', 'border', 'born',
  'bottom', 'brand', 'break', 'breathe', 'brightness', 'british', 'buck', 'build', 'buy', 'ca', 'cancel', 'caption', 'career',
  'cash', 'casual', 'caution', 'cause', 'celebrate', 'charm', 'cheers', 'christ', 'classy', 'click', 'colors', 'competition',
  'compose', 'confirm', 'confuse', 'confused', 'congratulations', 'connection', 'contest', 'continue', 'country', 'couple', 'cozy',
  'creativity', 'creepy', 'culture', 'currency', 'custom', 'danger', 'data', 'dead', 'deadline', 'deadly', 'death', 'decorative',
  'degree', 'delete', 'demand', 'denied', 'deny', 'deploy', 'depression', 'dial', 'direction', 'disabled', 'disallow', 'disaster',
  'display', 'divide', 'doubt', 'doubts', 'drained', 'drama', 'drop', 'drunk', 'east', 'eight', 'election', 'embarrassing',
  'emergency', 'enforcement', 'enterprise', 'entrance', 'environment', 'error', 'evict', 'evil', 'exit', 'expendable', 'expenses',
  'expensive', 'experiment', 'explode', 'explosion', 'express', 'extinct', 'eyesight', 'failure', 'fairness', 'faithful', 'female',
  'festival', 'finishline', 'flirt', 'forbid', 'formal', 'formula', 'forward', 'french', 'frightening', 'frown', 'frozen',
  'frustrated', 'ftw', 'gender', 'gentleman', 'geek', 'dork', 'glide', 'go', 'win', 'lose', 'happy', 'sad', 'angry', 'tired',
  'money', 'job', 'class', 'meeting', 'office', 'idea', 'mind', 'cute', 'pretty', 'beautiful', 'nice', 'free', 'open', 'close',
  'start', 'stop', 'end', 'up', 'down', 'left', 'right', 'north', 'south', 'west', 'yes', 'no', 'ok', 'okay', 'hello', 'bye', 'hi',
  'thanks', 'sorry', 'please', 'help', 'question', 'problem', 'secret', 'power', 'energy', 'magic', 'luck', 'lucky', 'peace',
  'war', 'fire', 'water', 'air', 'earth', 'space', 'time', 'speed', 'quick', 'slow', 'loud', 'quiet', 'big', 'small', 'tiny',
  'huge', 'strong', 'weak', 'smart', 'stupid', 'crazy', 'weird', 'funny', 'serious', 'important', 'special', 'rich', 'poor',
  'real', 'fake', 'true', 'false', 'wrong', 'correct', 'perfect', 'best', 'worst', 'top', 'over', 'under', 'inside', 'outside',
  'italian', 'indian', 'thai', 'greek', 'korean', 'spanish', 'vietnamese', 'german', 'grow', 'growth', 'success', 'progress', 'rise', 'decline', 'trend', 'chart', 'report', 'business', 'work', 'school', 'home']);
function concreteKeyword(k) {
  if (ABSTRACT.has(k)) return false;
  if (/(ing|ed|ly|ness|ity|ism|tion|sion|ment|ance|ence|ful|ous|ive|ic|ical|al|able|ible|est|er)$/.test(k) && k.length > 4) return false;
  return true;
}

const index = {};
const score = {};
const put = (word, e, s) => {
  if (!/^[a-z][a-z'-]{1,20}$/.test(word) || STOP.has(word)) return;
  if (score[word] === undefined || s < score[word]) { index[word] = e; score[word] = s; }
};
for (const [e, kws] of Object.entries(src)) {
  const cps = [...e].map((c) => c.codePointAt(0));
  if (cps.some((cp) => skipRanges.some(([a, b]) => cp >= a && cp <= b))) continue;
  if (cps.includes(0x200D) && cps.length > 3) continue;              // long ZWJ sequences (people combos)
  const name = kws[0].split(/[_\s]+/);
  if (name.length === 1) put(name[0], e, 0);                          // the emoji's own name
  else put(name[name.length - 1], e, 2);                               // "hot_dog" -> "dog" only weakly
  kws.slice(1).forEach((k) => { if (!/[_\s]/.test(k) && concreteKeyword(k)) put(k, e, 3); }); // keywords, lowest priority
}
for (const [w, e] of Object.entries(OVERRIDE)) { index[w.replace('_animal', '')] = e; }

const sorted = Object.keys(index).sort();
const body = sorted.map((w) => `${JSON.stringify(w)}:${JSON.stringify(index[w])}`).join(',');
const out = `/* Generated by tools/build-lexicon.js from emojilib (MIT License, (c) Mu-An Chiou). Do not edit by hand. */
(function (g) {
  var LEXICON = {${body}};
  if (typeof module !== 'undefined' && module.exports) module.exports = LEXICON; else g.JournalLexicon = LEXICON;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'lexicon.js'), out);
console.log(`${sorted.length} words -> js/lexicon.js (${(out.length / 1024).toFixed(1)} KB)`);
