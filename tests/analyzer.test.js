// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, splitSentences } = require('../js/analyzer.js');

test('picks the headline sentence as the main event', () => {
  const r = analyze('Woke up late and grabbed a coffee. Then Sarah threw me a surprise birthday party with a huge chocolate cake! Best night ever.');
  assert.match(r.mainEvent, /surprise birthday party/);
  assert.equal(r.scene, 'birthday');
  assert.ok(r.people.includes('Sarah'));
  assert.ok(r.props.includes('🎂'));
});

test('a promotion at the office is a win, not just work', () => {
  const r = analyze('Long day at the office. My boss finally told me I got the promotion!! I called Mom right away.');
  assert.equal(r.scene, 'win');
  assert.equal(r.mood, 'excited');
});

test('detects scenes for common days', () => {
  const cases = {
    beach: 'Took the dog to the beach this morning. He chased the waves for an hour.',
    rain: 'It rained all afternoon and I felt kind of lonely.',
    nature: 'Went hiking up the mountain with Jake. The view from the summit was incredible.',
    sports: 'Me and Tom played basketball and our team won the match!',
    travel: 'I went to Paris with Emma and we saw the Eiffel Tower at night.',
    music: 'Went to a concert and danced all night, the band was amazing.',
    food: 'Cooked pasta for dinner and it was delicious.',
    sick: 'Stayed home sick with a fever all day.',
    snow: 'It snowed! We built a snowman in the yard.',
    everyday: 'Hmm.'
  };
  for (const [scene, text] of Object.entries(cases)) assert.equal(analyze(text).scene, scene, text);
});

test('mood handles negation', () => {
  assert.equal(analyze('I was not happy about the meeting today.').mood === 'joyful', false);
  assert.equal(analyze('I cried a lot, feeling sad and lonely.').mood, 'sad');
});

test('time of day', () => {
  assert.equal(analyze('Watched the sunset on the beach this evening.').time, 'evening');
  assert.equal(analyze('Had breakfast with dad this morning.').time, 'morning');
  assert.equal(analyze('Stayed up until midnight playing games.').time, 'night');
});

test('places are not mistaken for people', () => {
  const r = analyze('I went to Paris with Emma and we saw the Eiffel Tower.');
  assert.deepEqual(r.people, ['Emma']);
});

test('handles empty input and long captions', () => {
  const empty = analyze('');
  assert.equal(empty.scene, 'everyday');
  const long = analyze('Today ' + 'we walked and talked and laughed '.repeat(10) + 'at the beach.');
  assert.ok(long.caption.length <= 110);
  assert.equal(splitSentences('One. Two! Three?').length, 3);
});
