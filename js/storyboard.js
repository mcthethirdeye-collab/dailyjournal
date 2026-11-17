/*
 * storyboard.js — reads a journal entry word by word and turns every sentence into a
 * panel script: where it happens, who is there, what they do, which things are
 * mentioned (and how many), the weather and the time of day. Each element remembers
 * the word it came from, so the animation can draw it the moment that word is written.
 *
 * Browser: window.JournalStoryboard.build(text). Node: require('./storyboard.js').build(text).
 */
(function (global) {
  'use strict';

  const LEX = typeof module !== 'undefined' && module.exports ? require('./lexicon.js') : global.JournalLexicon;
  const Analyzer = typeof module !== 'undefined' && module.exports ? require('./analyzer.js') : global.JournalAnalyzer;

  // ---------- vocabulary ----------
  const IRREGULAR = {
    went: 'go', gone: 'go', ate: 'eat', eaten: 'eat', drank: 'drink', drunk: 'drink', ran: 'run', saw: 'see', seen: 'see',
    met: 'meet', had: 'have', has: 'have', made: 'make', took: 'take', taken: 'take', got: 'get', gotten: 'get', gave: 'give',
    given: 'give', bought: 'buy', brought: 'bring', caught: 'catch', taught: 'teach', thought: 'think', felt: 'feel',
    slept: 'sleep', wrote: 'write', written: 'write', drove: 'drive', driven: 'drive', rode: 'ride', ridden: 'ride',
    flew: 'fly', flown: 'fly', swam: 'swim', sang: 'sing', sung: 'sing', sat: 'sit', stood: 'stand', won: 'win', lost: 'lose',
    fell: 'fall', fallen: 'fall', told: 'tell', said: 'say', came: 'come', left: 'leave', found: 'find', threw: 'throw',
    thrown: 'throw', kept: 'keep', began: 'begin', wore: 'wear', built: 'build', sent: 'send', spent: 'spend', hung: 'hang',
    held: 'hold', heard: 'hear', knew: 'know', meant: 'mean', paid: 'pay', sold: 'sell', woke: 'wake', woken: 'wake',
    cried: 'cry', tried: 'try', fried: 'fry', baked: 'bake', danced: 'dance', hugged: 'hug', kissed: 'kiss', chatted: 'chat',
    shopped: 'shop', jogged: 'jog', napped: 'nap', planned: 'plan', stopped: 'stop', dove: 'dive', dived: 'dive', fed: 'feed',
    hit: 'hit', cut: 'cut', put: 'put', read: 'read', let: 'let', quit: 'quit', bit: 'bite', drew: 'draw', drawn: 'draw',
    is: 'be', was: 'be', were: 'be', are: 'be', am: 'be', been: 'be', did: 'do', done: 'do', does: 'do'
  };

  // verb (base form) -> what the characters do
  const ACTIONS = {
    walk: 'walk', go: 'walk', stroll: 'walk', wander: 'walk', come: 'walk', leave: 'walk', head: 'walk', return: 'walk', arrive: 'walk',
    run: 'run', jog: 'run', race: 'run', sprint: 'run', rush: 'run', hurry: 'run', chase: 'run',
    eat: 'eat', drink: 'eat', taste: 'eat', munch: 'eat', bite: 'eat', snack: 'eat', devour: 'eat', sip: 'eat', try: 'eat', have: 'eat', grab: 'hold',
    cook: 'cook', bake: 'cook', fry: 'cook', grill: 'cook', boil: 'cook',
    dance: 'dance', party: 'dance', sing: 'sing', hum: 'sing', perform: 'sing',
    cry: 'cry', sob: 'cry', weep: 'cry', laugh: 'laugh', giggle: 'laugh', smile: 'laugh', joke: 'laugh',
    hug: 'hug', cuddle: 'hug', embrace: 'hug', kiss: 'kiss',
    talk: 'talk', chat: 'talk', say: 'talk', tell: 'talk', speak: 'talk', call: 'talk', text: 'talk', ask: 'talk', discuss: 'talk', gossip: 'talk', explain: 'talk', share: 'talk',
    sleep: 'sleep', nap: 'sleep', doze: 'sleep',
    read: 'read', study: 'read', learn: 'read', review: 'read',
    write: 'write', draw: 'write', paint: 'write', sketch: 'write', journal: 'write',
    work: 'work', type: 'work', code: 'work', email: 'work',
    watch: 'watch', stream: 'watch', binge: 'watch',
    swim: 'swim', dive: 'swim', surf: 'swim', drive: 'drive', commute: 'drive', ride: 'ride', cycle: 'ride', bike: 'ride',
    fly: 'fly', climb: 'climb', hike: 'climb', trek: 'climb',
    jump: 'jump', celebrate: 'jump', cheer: 'jump', win: 'win', lose: 'cry', fail: 'cry',
    buy: 'carry', shop: 'carry', get: 'hold', receive: 'hold', find: 'hold', bring: 'hold', carry: 'hold', hold: 'hold',
    take: 'hold', pick: 'hold', open: 'hold', give: 'give', send: 'give', gift: 'give', feed: 'give', show: 'give',
    throw: 'throw', toss: 'throw', kick: 'throw', catch: 'throw', play: 'play',
    sit: 'sit', wait: 'sit', relax: 'sit', rest: 'sit', chill: 'sit', stay: 'sit',
    stand: 'stand', meet: 'wave', see: 'wave', visit: 'wave', greet: 'wave', wave: 'wave', welcome: 'wave',
    fall: 'fall', trip: 'fall', slip: 'fall', crash: 'fall',
    think: 'think', wonder: 'think', remember: 'think', dream: 'think', miss: 'think', want: 'think', wish: 'think', hope: 'think', imagine: 'think', plan: 'think', worry: 'think',
    argue: 'argue', fight: 'argue', yell: 'argue', shout: 'argue', scream: 'argue',
    wake: 'wake', listen: 'listen', hear: 'listen', clean: 'clean', wash: 'clean', vacuum: 'clean', tidy: 'clean',
    garden: 'clean', plant: 'clean', build: 'clean', fix: 'clean', make: 'cook', feel: null, be: null, do: null
  };
  // where an action usually happens, when no place is written ("strong" ones change the scene)
  const ACTION_PLACE = {
    sleep: ['bedroom', true], wake: ['bedroom', true], cook: ['kitchen', true], drive: ['road', true], fly: ['sky', true],
    swim: ['pool', false], work: ['office', false], read: ['home', false], watch: ['home', false], climb: ['nature', false],
    carry: ['store', false], run: ['park', false], sing: ['stage', false], dance: ['stage', false], write: ['home', false]
  };

  const PLACES = {
    park: 'park', playground: 'park', bench: 'park', zoo: 'park',
    beach: 'beach', ocean: 'beach', sea: 'beach', seaside: 'beach', shore: 'beach', coast: 'beach', lake: 'beach', river: 'beach',
    home: 'home', house: 'home', apartment: 'home', flat: 'home', couch: 'home', sofa: 'home', 'living room': 'home', place: null,
    bedroom: 'bedroom', bed: 'bedroom', kitchen: 'kitchen', office: 'office', desk: 'office', meeting: 'office', work: 'office',
    school: 'school', class: 'school', classroom: 'school', university: 'school', college: 'school', campus: 'school', library: 'school', lecture: 'school', exam: 'school',
    restaurant: 'restaurant', cafe: 'restaurant', 'coffee shop': 'restaurant', diner: 'restaurant', bar: 'restaurant', pub: 'restaurant', bakery: 'restaurant',
    store: 'store', shop: 'store', mall: 'store', market: 'store', supermarket: 'store', 'grocery store': 'store', groceries: 'store',
    gym: 'gym', hospital: 'hospital', clinic: 'hospital', 'doctor\'s': 'hospital', dentist: 'hospital', pharmacy: 'hospital',
    city: 'city', town: 'city', downtown: 'city', street: 'city', neighborhood: 'city', square: 'city', museum: 'city', church: 'city', station: 'city',
    mountain: 'nature', mountains: 'nature', forest: 'nature', woods: 'nature', trail: 'nature', hill: 'nature', camp: 'nature', camping: 'nature', countryside: 'nature', farm: 'nature',
    road: 'road', highway: 'road', 'road trip': 'road', car: 'road', traffic: 'road',
    airport: 'airport', terminal: 'airport', gate: 'airport', plane: 'sky', flight: 'sky', airplane: 'sky',
    concert: 'stage', stage: 'stage', club: 'stage', festival: 'stage', show: 'stage', theater: 'cinema', theatre: 'cinema',
    cinema: 'cinema', movies: 'cinema', 'movie theater': 'cinema',
    pool: 'pool', garden: 'garden', yard: 'garden', backyard: 'garden', balcony: 'garden', party: 'party'
  };
  const PLACE_ICON = {
    park: '🏞️', beach: '🏖️', home: '🏠', bedroom: '🛏️', kitchen: '🍳', office: '🏢', school: '🏫', restaurant: '🍽️', store: '🏪',
    gym: '🏋️', hospital: '🏥', city: '🏙️', nature: '⛰️', road: '🚗', airport: '🛫', sky: '✈️', stage: '🎤', cinema: '🎬', pool: '🏊',
    garden: '🌻', party: '🎉', outside: '🌳'
  };
  const PLACE_LABEL = {
    park: 'Park', beach: 'Beach', home: 'Home', bedroom: 'Bedroom', kitchen: 'Kitchen', office: 'Office', school: 'School',
    restaurant: 'Restaurant', store: 'Store', gym: 'Gym', hospital: 'Hospital', city: 'City', nature: 'Outdoors', road: 'Road', airport: 'Airport',
    sky: 'Flight', stage: 'Stage', cinema: 'Cinema', pool: 'Pool', garden: 'Garden', party: 'Party', outside: 'Outside'
  };

  const PEOPLE = {
    friend: 'Friend', friends: ['Friends', 2], mom: 'Mom', mum: 'Mum', mother: 'Mom', dad: 'Dad', father: 'Dad', parents: ['Parents', 2],
    sister: 'Sister', brother: 'Brother', grandma: 'Grandma', grandpa: 'Grandpa', grandmother: 'Grandma', grandfather: 'Grandpa',
    girlfriend: 'Girlfriend', boyfriend: 'Boyfriend', wife: 'Wife', husband: 'Husband', partner: 'Partner', fiance: 'Fiancé', fiancee: 'Fiancée',
    kids: ['Kids', 2], children: ['Kids', 2], son: 'Son', daughter: 'Daughter', boss: 'Boss', coworker: 'Coworker',
    coworkers: ['Coworkers', 2], colleague: 'Colleague', colleagues: ['Colleagues', 2], team: ['Team', 3], family: ['Family', 3],
    cousin: 'Cousin', cousins: ['Cousins', 2], aunt: 'Aunt', uncle: 'Uncle', roommate: 'Roommate', neighbor: 'Neighbor',
    neighbour: 'Neighbour', teacher: 'Teacher', doctor: 'Doctor', nurse: 'Nurse', baby: 'Baby', classmates: ['Classmates', 2],
    classmate: 'Classmate', guy: 'Someone', girl: 'Someone', boy: 'Someone', man: 'Someone', woman: 'Someone', stranger: 'Stranger',
    everyone: ['Everyone', 3], people: ['People', 3], crush: 'Crush', date: null, bestie: 'Bestie', bff: 'BFF'
  };
  const ME = new Set(['i', 'me', 'my', 'myself', 'mine', "i'm", "i've", "i'd", "i'll", 'im']);
  const WE = new Set(['we', 'us', 'our', 'ourselves', "we're", "we've", "we'd"]);
  const THIRD = new Set(['he', 'she', 'him', 'her', 'they', 'them', "he's", "she's", "they're"]);
  const NEGATORS = new Set(['not', 'never', "didn't", "don't", "doesn't", "wasn't", "weren't", "couldn't", "can't", "cannot",
    "won't", "wouldn't", "haven't", "hasn't", 'no', "isn't", "aren't", "shouldn't"]);
  const NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    couple: 2, few: 3, several: 3, some: 0, many: 5, lots: 5, dozen: 5 };
  const DETERMINERS = new Set(['a', 'an', 'the', 'my', 'our', 'his', 'her', 'their', 'your', 'this', 'that', 'these', 'those',
    'some', 'new', 'big', 'little', 'small', 'old', 'favorite', 'favourite', 'huge', 'tiny', 'delicious', 'hot', 'cold', 'nice',
    'whole', 'giant', 'fresh', 'first', 'last', 'another', 'every', 'two', 'three', 'four', 'five', 'few', 'of']);
  // words that are never drawn as objects even if an emoji exists for them
  const NOT_THINGS = new Set(['morning', 'evening', 'afternoon', 'night', 'today', 'tonight', 'yesterday', 'tomorrow', 'week',
    'weekend', 'day', 'time', 'more', 'still', 'first', 'second', 'cool', 'awesome', 'late', 'early', 'lonely', 'sorry', 'wish',
    'stop', 'way', 'lady', 'room', 'city', 'warm', 'sunny', 'cloudy', 'team', 'baby', 'date', 'job', 'lunch', 'dinner', 'breakfast',
    'brunch', 'party', 'trip', 'fun', 'love', 'life', 'hour', 'minute', 'moment', 'year', 'month', 'kind', 'lot', 'bit', 'thing',
    'stuff', 'show', 'place', 'start', 'end', 'top', 'bottom', 'side', 'part', 'half', 'whole', 'best', 'last', 'next', 'back',
    'new', 'old', 'own', 'free', 'fine', 'well', 'right', 'left', 'light', 'dark', 'hard', 'soft', 'happy', 'sad', 'glad', 'mad',
    'tired', 'sick', 'ill', 'bored', 'proud', 'safe', 'sure', 'ready', 'busy', 'calm', 'quiet', 'loud', 'clean', 'dirty', 'full',
    'empty', 'open', 'closed', 'fast', 'slow', 'cute', 'pretty', 'beautiful', 'ugly', 'great', 'good', 'bad', 'nice', 'amazing',
    'perfect', 'wonderful', 'terrible', 'awful', 'super', 'crazy', 'wild', 'weird', 'funny', 'tasty', 'yummy', 'fancy', 'chill',
    'goal', 'point', 'win', 'world', 'idea', 'mind', 'head', 'hand', 'heart', 'face', 'eye', 'eyes', 'body', 'feet', 'foot',
    'leg', 'arm', 'name', 'word', 'words', 'story', 'news', 'question', 'answer', 'problem', 'plan', 'plans', 'rest', 'sleep',
    'nap', 'walk', 'run', 'ride', 'drive', 'swim', 'hike', 'visit', 'call', 'chat', 'talk', 'look', 'smile', 'laugh', 'kiss',
    'hug', 'dance', 'cry', 'fight', 'step', 'steps', 'turn', 'line', 'lines', 'round', 'set', 'match', 'game', 'games', 'meeting',
    'class', 'exam', 'test', 'work', 'shift', 'project', 'task', 'tasks', 'deadline', 'mood', 'feeling', 'feelings', 'weather',
    'season', 'summer', 'winter', 'spring', 'fall', 'autumn', 'christmas', 'halloween', 'birthday', 'anniversary', 'holiday',
    'vacation', 'surprise', 'everyone', 'someone', 'something', 'nothing', 'everything', 'anything', 'all', 'both', 'each', 'other', 'others']);
  // things that live in the sky / move around on their own
  const SKY = new Set(['☀️', '🌙', '⭐', '✨', '🌈', '☁️', '✈️', '🐦', '🪁', '🎈', '🎆', '🎇', '🚀', '🚁', '🦋', '🐝', '⚡', '🌧️', '❄️', '🦅', '🕊️', '🦉', '🌠', '🛸']);
  const ANIMALS = new Set(['🐕', '🐶', '🐈', '🐱', '🐎', '🐄', '🐖', '🐑', '🦆', '🐔', '🐇', '🐰', '🐭', '🐻', '🦁', '🐅', '🐘', '🐒',
    '🐢', '🐸', '🐹', '🦜', '🐤', '🐿️', '🦊', '🦌', '🐐', '🦒', '🦓', '🐊', '🐍', '🦔', '🐩', '🦮', '🐕‍🦺']);
  const PHRASES = { 'ice cream': '🍦', 'hot dog': '🌭', 'french fries': '🍟', 'birthday cake': '🎂', 'video game': '🎮',
    'video games': '🎮', 'board game': '🎲', 'board games': '🎲', 'teddy bear': '🧸', 'christmas tree': '🎄', 'fried chicken': '🍗',
    'cell phone': '📱', 'phone call': '📱', 'ice skates': '⛸️', 'french toast': '🍞', 'hot chocolate': '☕', 'soccer ball': '⚽',
    'paper plane': '✈️', 'love letter': '💌', 'golden retriever': '🦮', 'sea shell': '🐚', 'sand castle': '🏰', 'snow man': '⛄' };
  const WEATHER = { rain: 'rain', rained: 'rain', raining: 'rain', rainy: 'rain', storm: 'rain', stormy: 'rain', thunder: 'rain',
    pouring: 'rain', drizzle: 'rain', snow: 'snow', snowed: 'snow', snowing: 'snow', snowy: 'snow', blizzard: 'snow',
    sunny: 'sun', sunshine: 'sun', windy: 'wind', wind: 'wind', breeze: 'wind', foggy: 'fog', fog: 'fog' };
  const TIMES = { morning: 'morning', sunrise: 'morning', dawn: 'morning', breakfast: 'morning', afternoon: 'day', noon: 'day',
    lunch: 'day', evening: 'evening', sunset: 'evening', dusk: 'evening', dinner: 'evening', night: 'night', tonight: 'night',
    midnight: 'night', dark: 'night', stars: 'night', moon: 'night' };
  const NAME_STOP = new Set(['I', 'The', 'A', 'An', 'It', 'We', 'My', 'Our', 'Today', 'Yesterday', 'Tonight', 'Then', 'After',
    'Before', 'So', 'But', 'And', 'Or', 'When', 'While', 'This', 'That', 'There', 'Here', 'What', 'Why', 'How', 'Finally', 'Later',
    'Also', 'Just', 'Now', 'Still', 'Even', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
    'Christmas', 'Easter', 'Halloween', 'Thanksgiving', 'God', 'OK', 'Ok', 'Wow', 'Oh', 'Yay', 'Ugh', 'Lol', 'He', 'She', 'They',
    'Me', 'Us', 'Him', 'Her', 'Them', 'Mr', 'Mrs', 'Ms', 'Dr', 'At', 'In', 'On', 'With', 'For', 'From', 'To', 'Of', 'Not', 'No',
    'Yes', 'Netflix', 'Youtube', 'YouTube', 'Instagram', 'Google', 'Starbucks', 'Spotify', 'Uber', 'Amazon']);
  const PLACE_PREPS = new Set(['to', 'in', 'at', 'from', 'near', 'into', 'around', 'through', 'across', 'toward', 'towards', 'visited', 'the', 'of']);

  // ---------- helpers ----------
  const lower = (w) => w.toLowerCase().replace(/[’]/g, "'");
  const bare = (w) => lower(w).replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

  function singular(w) {
    if (w.length < 4 || /ss$/.test(w)) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function verbBase(w) {
    if (IRREGULAR[w]) return IRREGULAR[w];
    if (w in ACTIONS) return w;
    const cands = [];
    if (/ing$/.test(w)) { const s = w.slice(0, -3); cands.push(s, s + 'e', s.replace(/(.)\1$/, '$1')); }
    if (/ied$/.test(w)) cands.push(w.slice(0, -3) + 'y');
    if (/ed$/.test(w)) { const s = w.slice(0, -2); cands.push(s, w.slice(0, -1), s.replace(/(.)\1$/, '$1')); }
    if (/ies$/.test(w)) cands.push(w.slice(0, -3) + 'y');
    if (/es$/.test(w)) cands.push(w.slice(0, -2));
    if (/s$/.test(w)) cands.push(w.slice(0, -1));
    return cands.find((c) => c in ACTIONS) || null;
  }
  const KEEP_PLURAL = new Set(['glasses', 'sunglasses', 'pants', 'jeans', 'shorts', 'scissors', 'clothes', 'fries', 'headphones',
    'cards', 'dice', 'socks', 'boots', 'gloves', 'groceries', 'stars', 'fireworks', 'balloons', 'flowers', 'books', 'leaves', 'waves', 'eggs', 'noodles', 'pancakes', 'pills']);
  function lookupThing(w) {
    if (NOT_THINGS.has(w) || NOT_THINGS.has(singular(w))) return null;
    if (KEEP_PLURAL.has(w)) return LEX[w] || LEX[singular(w)] || null;
    return LEX[singular(w)] || LEX[w] || null;
  }

  function splitSentences(text) {
    const out = [];
    const re = /[^.!?\n]+[.!?]*["')\]]*/g;
    let m;
    while ((m = re.exec(text))) {
      const s = m[0].trim();
      if (s.replace(/[^A-Za-z0-9]/g, '').length) out.push(s);
    }
    return out;
  }

  // ---------- one sentence -> one panel ----------
  function parseSentence(sentence, ctx) {
    const raw = sentence.split(/\s+/).filter(Boolean);
    const words = raw.map((w) => ({ text: w, low: bare(w) }));
    const beat = {
      sentence, words: raw, setting: null, settingWord: -1, time: null, weather: null, weatherWord: -1,
      cast: [], action: null, actionWord: -1, verb: null, actions: [], negated: false, things: [], mood: 'calm'
    };
    const addPerson = (key, label, count, i, isMe) => {
      let p = beat.cast.find((c) => c.key === key);
      if (!p) { p = { key, label, count: count || 1, word: i, isMe: !!isMe }; beat.cast.push(p); ctx.known.set(key, p); }
      return p;
    };
    let subjectSet = false;

    for (let i = 0; i < words.length; i++) {
      const w = words[i].low;
      if (!w) continue;
      const prev = i > 0 ? words[i - 1].low : '';
      const next = i + 1 < words.length ? words[i + 1].low : '';
      const pair = next ? w + ' ' + next : '';
      const trip = i + 2 < words.length ? pair + ' ' + words[i + 2].low : '';

      // people
      if (ME.has(w)) { addPerson('me', 'Me', 1, i, true); subjectSet = true; continue; }
      if (WE.has(w)) {
        addPerson('me', 'Me', 1, i, true);
        const here = beat.cast.filter((p) => !p.isMe);
        const before = (ctx.lastCast || []).filter((p) => !p.isMe);
        if (!here.length) {
          if (before.length) before.slice(0, 3).forEach((p) => addPerson(p.key, p.label, p.count, i));
          else addPerson('friend', 'Friend', 1, i);
        }
        subjectSet = true; continue;
      }
      if (THIRD.has(w)) {
        const others = beat.cast.filter((p) => !p.isMe).length ? beat.cast.filter((p) => !p.isMe) : (ctx.lastCast || []).filter((p) => !p.isMe);
        if (others.length) {
          const pick = /^the(y|m)/.test(w) ? others.slice(-3) : others.slice(-1);
          pick.forEach((p) => addPerson(p.key, p.label, p.count, i));
        }
        continue;
      }
      if (PEOPLE[w] !== undefined && PEOPLE[w] !== null && !(w === 'baby' && prev === 'a' && false)) {
        const v = PEOPLE[w];
        const [label, count] = Array.isArray(v) ? v : [v, 1];
        const owner = prev === 'my' ? 'My ' : '';
        addPerson(w, label === 'Someone' || label === 'Stranger' ? label : (owner && label.length < 9 ? label : label), count, i);
        continue;
      }
      const capWord = words[i].text.replace(/[^A-Za-z'’]/g, '').replace(/['’]s$/, '');
      if (/^[A-Z][a-z]{2,}$/.test(capWord) && /^(to|in|at|from|visited|near)$/.test(prev) && !NAME_STOP.has(capWord) && !beat.placeName) {
        let name = capWord, k = i + 1;
        while (k < words.length && /^[A-Z][a-z]+$/.test(words[k].text.replace(/[^A-Za-z]/g, '')) && name.length < 24) { name += ' ' + words[k].text.replace(/[^A-Za-z]/g, ''); k++; }
        beat.placeName = name; beat.placeNameWord = i; i = k - 1; continue;
      }
      if (/^[A-Z][a-z]{1,14}$/.test(capWord) && !NAME_STOP.has(capWord) && !PLACE_PREPS.has(prev) &&
          !(i + 1 < words.length && /^[A-Z]/.test(words[i + 1].text)) && !lookupThing(lower(capWord)) && !PLACES[lower(capWord)]) {
        const startOfSentence = i === 0;
        const looksLikeName = !startOfSentence || verbBase(next) || next === 'and' || next === 'was' || next === "and" || /['’]s$/.test(words[i].text);
        if (looksLikeName) { addPerson('name:' + capWord, capWord, 1, i); continue; }
      }

      // negation
      if (NEGATORS.has(w) || /n't$/.test(w)) { beat.negated = true; continue; }

      // places (multi-word first)
      const placeKey = [trip, pair, w].find((k) => k && PLACES[k]);
      if (placeKey && beat.settingWord < 0 && !(w === 'work' && !/^(at|to|from|after|before)$/.test(prev)) &&
          !(w === 'bed' && !/^(to|in|into|on)$/.test(prev) && !/^(my|the)$/.test(prev)) &&
          !(w === 'show' && !/^(a|the)$/.test(prev)) && !(w === 'car' && beat.action !== 'drive' && !/^(the|my|a|our|by)$/.test(prev)) &&
          !(w === 'party' && !/^(a|the|to|at|birthday|surprise|dinner|house|costume|pool)$/.test(prev)) && !(w === 'class' && !/^(to|in|after|before|my|the)$/.test(prev))) {
        beat.setting = PLACES[placeKey]; beat.settingWord = i;
        if (placeKey !== w) i += placeKey.split(' ').length - 1;
        continue;                                  // a place word is never also the verb ("birthday party")
      }

      // time & weather
      if (TIMES[w] && !beat.time) beat.time = TIMES[w];
      if (WEATHER[w] && !beat.weather) { beat.weather = WEATHER[w]; beat.weatherWord = i; }

      // things (phrases first)
      const phrase = [pair].find((k) => k && PHRASES[k]);
      if (phrase) {
        addThing(beat, PHRASES[phrase], phrase, i, countBefore(words, i));
        i++; continue;
      }

      // verbs
      const base = verbBase(w);
      const nounish = DETERMINERS.has(prev) && !/[,;:]$/.test(i > 0 ? words[i - 1].text : '');
      if (base && !nounish && ACTIONS[base] !== undefined) {
        // "had" only means eating when food follows
        if (ACTIONS[base] && !(base === 'have' && !nextIsFood(words, i))) {
          let kind = ACTIONS[base];
          if (base === 'throw' && /\bpart(y|ies)\b/i.test(sentence)) kind = 'jump';      // "threw me a party"
          if (base === 'see' && /\b(movie|film|show|play|concert)\b/i.test(sentence)) kind = 'watch';
          const lastA = beat.actions[beat.actions.length - 1];
          if ((!lastA || lastA.kind !== kind) && beat.actions.length < 3) beat.actions.push({ kind, word: i, verb: base });
          // the main action is the first "strong" one; going/meeting/sitting are only background
          if (!beat.action || ['walk', 'wave', 'sit', 'hold', 'wake'].includes(beat.action)) { beat.action = kind; beat.actionWord = i; beat.verb = base; }
        }
        if (!(LEX[w] && nounish)) continue;
      }

      const emoji = lookupThing(w);
      if (emoji && !PLACES[w] && !TIMES[w] && !WEATHER[w]) addThing(beat, emoji, w, i, countBefore(words, i));
    }

    // "My dog chased two birds": an animal before the first verb is the one doing it
    const firstVerb = beat.actions.length ? beat.actions[0].word : -1;
    const actor = beat.things.find((th) => th.kind === 'animal' && firstVerb >= 0 && th.wordIndex < firstVerb);
    const personBefore = beat.cast.some((c) => c.word < firstVerb && !(c.isMe && /^my$/i.test(bare(raw[c.word]))));
    if (actor && !personBefore) beat.animalActor = actor.emoji;

    // a sentence with no person at all is still about the writer
    if (!beat.cast.some((c) => c.isMe) && !beat.cast.length) addPerson('me', 'Me', 1, 0, true);
    else if (!beat.cast.some((c) => c.isMe) && subjectSet === false && beat.action && beat.cast[0] && beat.actionWord < beat.cast[0].word) {
      // "Went to the park with Jake" -> me + Jake
      addPerson('me', 'Me', 1, 0, true);
    }
    const fv = beat.actions.length ? beat.actions[0].word : Infinity;
    const doers = beat.cast.filter((c) => c.word < fv && !(c.isMe && /^my$/i.test(bare(raw[c.word]))));
    const subj = doers.length ? doers.reduce((a, c) => (c.word < a.word ? c : a)) : null;
    beat.cast.sort((a, b) => ((b === subj) - (a === subj)) || (b.isMe - a.isMe) || (a.word - b.word));
    beat.cast = beat.cast.slice(0, 4);

    // place: written > strongly implied by the action > previous panel > implied > outside
    // "ran home", "drove to the office": show the trip outdoors, heading for the destination
    const MOVES = ['walk', 'run', 'drive', 'ride'];
    const INDOOR = ['home', 'office', 'school', 'kitchen', 'restaurant', 'store', 'gym', 'hospital', 'cinema', 'bedroom', 'airport', 'party'];
    const mv = beat.actions.find((a) => MOVES.includes(a.kind) && a.word < beat.settingWord && beat.settingWord - a.word <= 3);
    if (mv && INDOOR.includes(beat.setting) && !beat.negated) {
      beat.destination = beat.setting; beat.destinationWord = beat.settingWord;
      beat.setting = mv.kind === 'drive' ? 'road' : (ctx.setting && !INDOOR.includes(ctx.setting) ? ctx.setting : 'city');
      beat.settingWord = -1;
    }
    // "I didn't go to the gym": stay where we were and show the gym crossed out in a thought bubble
    if (beat.negated && beat.setting) { beat.notPlace = beat.setting; beat.notPlaceWord = beat.settingWord; beat.setting = null; }
    const strong = beat.actions.map((a) => ACTION_PLACE[a.kind]).find((p) => p && p[1]);
    const implied = strong || ACTION_PLACE[beat.action] || (beat.verb && ACTION_PLACE[beat.verb]);
    if (!beat.setting) {
      if (implied && implied[1]) beat.setting = implied[0];
      else if (ctx.setting) beat.setting = ctx.setting;
      else if (implied) beat.setting = implied[0];
      else beat.setting = 'outside';
    }
    const samePlace = beat.setting === ctx.setting;
    // waking up happens in the bedroom, but the rest of the day doesn't
    // after bed you're at home; after a flight you've landed somewhere
    ctx.setting = beat.setting === 'bedroom' ? 'home' : beat.setting === 'sky' ? 'outside' : beat.setting;
    beat.time = beat.time || (samePlace && ctx.time) || (beat.setting === 'stage' || beat.action === 'sleep' ? 'night' : 'day');
    ctx.time = beat.time;
    // weather is drawn only in the sentence that mentions it
    ctx.lastCast = beat.cast.slice();

    const a = Analyzer ? Analyzer.analyze(sentence) : null;
    beat.mood = beat.action === 'cry' ? 'sad' : beat.action === 'argue' ? 'angry' : a ? a.mood : 'calm';
    if (beat.negated && beat.mood === 'joyful') beat.mood = 'calm';
    return beat;
  }

  function countBefore(words, i) {
    for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
      const w = words[k].low;
      if (/^\d+$/.test(w)) return Math.min(5, parseInt(w, 10));
      if (NUMBERS[w] !== undefined && NUMBERS[w] > 0 && !(w === 'a' || w === 'an')) return Math.min(5, NUMBERS[w]);
    }
    return /s$/.test(words[i].low) && !/ss$/.test(words[i].low) && words[i].low.length > 3 ? 2 : 1;
  }
  function nextIsFood(words, i) {
    for (let k = i + 1; k < Math.min(words.length, i + 5); k++) {
      const e = lookupThing(words[k].low);
      if (e && /[\u{1F32D}-\u{1F37F}\u{1F950}-\u{1F96F}\u{1F9C0}-\u{1F9CB}☕🍵]/u.test(e)) return true;
      if (['breakfast', 'lunch', 'dinner', 'brunch', 'coffee', 'tea', 'drink', 'drinks', 'snack', 'meal', 'dessert'].includes(words[k].low)) return true;
    }
    return false;
  }
  function addThing(beat, emoji, word, i, count) {
    if (beat.things.some((t) => t.emoji === emoji)) return;
    if (beat.things.length >= 6) return;
    beat.things.push({ emoji, word, wordIndex: i, count: count || 1, kind: SKY.has(emoji) ? 'sky' : ANIMALS.has(emoji) ? 'animal' : 'thing' });
  }

  // ---------- timing ----------
  const LEAD = 0.45, HOLD = 1.7, MAX_BEATS = 12;
  function time(beats) {
    let t = 0;
    for (const b of beats) {
      const n = b.words.length;
      const per = Math.min(0.32, Math.max(0.16, 5.5 / Math.max(1, n)));
      b.start = t;
      b.wordTimes = b.words.map((_, i) => LEAD + i * per);
      b.duration = Math.max(3.2, LEAD + n * per + HOLD);
      // what the panel needs at each moment
      b.actionAt = b.actionWord >= 0 ? b.wordTimes[b.actionWord] : 0;
      b.actions.forEach((a) => { a.at = b.wordTimes[a.word]; });
      b.cast.forEach((c) => { c.at = b.wordTimes[c.word] || 0; });
      b.things.forEach((th) => { th.at = b.wordTimes[th.wordIndex] || 0; });
      b.settingAt = 0;
      t += b.duration;
    }
    return t;
  }

  function build(text) {
    const clean = (text || '').trim();
    const sentences = splitSentences(clean).slice(0, MAX_BEATS);
    const ctx = { known: new Map(), setting: null, time: null, weather: null, lastCast: [] };
    const beats = sentences.map((s) => parseSentence(s, ctx));
    if (!beats.length) beats.push(parseSentence('…', ctx));
    const duration = time(beats);
    const people = [], things = [], places = [];
    for (const b of beats) {
      b.cast.forEach((c) => { if (!c.isMe && !people.includes(c.label)) people.push(c.label); });
      b.things.forEach((t) => { if (!things.includes(t.emoji)) things.push(t.emoji); });
      if (!places.includes(PLACE_LABEL[b.setting])) places.push(PLACE_LABEL[b.setting]);
    }
    return { beats, duration, people, things, places };
  }

  const api = { build, splitSentences, PLACE_LABEL, PLACE_ICON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.JournalStoryboard = api;
})(typeof window !== 'undefined' ? window : globalThis);
