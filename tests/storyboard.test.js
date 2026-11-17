// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../js/storyboard.js');

const beat = (text) => build(text).beats[0];
const emojis = (b) => b.things.map((t) => t.emoji);

test('one panel per sentence, in order', () => {
  const sb = build('I woke up. I ate pizza. We danced!');
  assert.equal(sb.beats.length, 3);
  assert.deepEqual(sb.beats.map((b) => b.sentence), ['I woke up.', 'I ate pizza.', 'We danced!']);
  assert.ok(sb.duration > 9);
});

test('every mentioned thing is drawn, with its count', () => {
  const b = beat('Mom and I baked three cookies and a pie in the kitchen.');
  assert.equal(b.setting, 'kitchen');
  assert.equal(b.action, 'cook');
  assert.deepEqual(b.cast.map((c) => c.label).sort(), ['Me', 'Mom']);
  const cookie = b.things.find((t) => t.emoji === '🍪');
  assert.equal(cookie.count, 3);
  assert.ok(emojis(b).includes('🥧'));
});

test('elements appear when their word is written', () => {
  const b = beat('I ate pizza with Tom at the park.');
  const pizza = b.things.find((t) => t.emoji === '🍕');
  const tom = b.cast.find((c) => c.label === 'Tom');
  assert.equal(b.words[pizza.wordIndex], 'pizza');
  assert.equal(b.words[tom.word], 'Tom');
  assert.ok(pizza.at < tom.at);
  assert.equal(b.setting, 'park');
});

test('the doer comes first', () => {
  const b = beat('Lily gave me a birthday cake.');
  assert.equal(b.cast[0].label, 'Lily');
  assert.equal(b.action, 'give');
});

test('an animal before the verb acts it out', () => {
  const b = beat('My dog chased two birds.');
  assert.equal(b.animalActor, '🐕');
  assert.equal(b.things.find((t) => t.emoji === '🐦').count, 2);
});

test('negation shows the thing crossed out instead of doing it', () => {
  const b = build('I was at home. I did not go to the gym.').beats[1];
  assert.equal(b.negated, true);
  assert.equal(b.notPlace, 'gym');
  assert.equal(b.setting, 'home');
});

test('thinking about someone puts them in a thought bubble', () => {
  const b = beat('I miss my grandma.');
  assert.equal(b.action, 'think');
  assert.ok(b.cast.some((c) => c.label === 'Grandma'));
});

test('verbs are not drawn as objects, nouns after a determiner are', () => {
  const b = beat('I watch TV and wear my new watch.');
  assert.equal(b.action, 'watch');
  assert.ok(emojis(b).includes('⌚'));
  assert.ok(emojis(b).includes('📺'));
});

test('places, times, weather and named places', () => {
  assert.equal(beat('We hugged at the airport.').setting, 'airport');
  assert.equal(beat('It rained all evening.').weather, 'rain');
  assert.equal(beat('It rained all evening.').time, 'evening');
  assert.equal(beat('We flew to Rome.').placeName, 'Rome');
  const sb = build('We flew to Rome. I walked in the snow tonight. I was happy.');
  assert.equal(sb.beats[1].setting, 'outside');
  assert.equal(sb.beats[2].weather, null);
});

test('several actions in one sentence are kept in order', () => {
  const b = beat('We drove to the beach and swam in the ocean.');
  assert.deepEqual(b.actions.map((a) => a.kind), ['drive', 'swim']);
  assert.equal(b.setting, 'beach');
});
