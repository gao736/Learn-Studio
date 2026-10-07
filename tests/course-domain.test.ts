import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGoal, buildSchedule, validateMaterial, gradeLesson, estimateFen, safeSourceURL } from '../src/features/course/domain.ts';
import { fixtureMaterial } from './fixtures/course.ts';

test('a topic alone defaults to 30 days and 30 minutes, invalid duration is rejected', () => {
  const goal = validateGoal({ topic: '天文学', startDate: '2026-10-30' });
  assert.equal(goal.days, 30); assert.equal(goal.dailyMinutes, 30);
  for (const days of [0, -1, 1.5, 366, '30x']) assert.throws(() => validateGoal({ ...goal, days }));
  assert.throws(() => validateGoal({ ...goal, topic: ' ', dailyMinutes: 300 }));
  assert.throws(() => validateGoal({ ...goal, startDate: '2026-02-30' }));
});
test('calendar crosses month boundaries and all allocations respect the total daily budget', () => {
  const goal = validateGoal({ topic: '天文学', days: 9, dailyMinutes: 7, startDate: '2026-10-30' });
  const slots = buildSchedule(goal, ['基础概念', '天空观察']);
  assert.equal(slots.length, 9); assert.equal(slots[2].date, '2026-11-01');
  assert.equal(slots[7].week, 2); assert.equal(slots[8].date, '2026-11-07');
  assert.deepEqual([slots[0].learn, slots[0].practice, slots[0].review], [3, 2, 2]);
  assert.ok(slots.every(day => day.learn + day.practice + day.review === 7));
});
test('generated material must cite supplied sources and contain valid independent questions', () => {
  const goal = validateGoal({ topic: '天文学', days: 7, startDate: '2026-10-06' });
  const material = validateMaterial(fixtureMaterial, goal, ['s1']);
  assert.equal(gradeLesson(material.lesson.questions, { q1:'1', q2:'0', q3:'2', q4:'1', q5:'0', score:999 }).score, 5);
  assert.throws(() => gradeLesson(material.lesson.questions, { q1:'1' }));
  assert.throws(() => validateMaterial({ ...fixtureMaterial, sourceInsufficient: true, reason:'不足以支持天体演化' }, goal, ['s1']), /资料不足/);
  assert.throws(() => validateMaterial(fixtureMaterial, goal, ['different-source']));
  const invalid = structuredClone(fixtureMaterial); invalid.lesson.questions[0].correctIndex = 99;
  assert.throws(() => validateMaterial(invalid, goal, ['s1']));
});
test('source boundary denies local/private URLs, credentials and unverified redirect hosts', () => {
  for (const url of ['http://science.nasa.gov/a','https://127.0.0.1/a','https://science.nasa.gov.evil.test/a','https://user:pass@science.nasa.gov/a','https://science.nasa.gov:8443/a']) {
    assert.throws(() => safeSourceURL(url));
  }
  assert.equal(safeSourceURL('https://science.nasa.gov/universe/stars/#intro'), 'https://science.nasa.gov/universe/stars/');
});
test('usage estimates round up and never accept invalid billing counters', () => {
  assert.equal(estimateFen({ inputTokens:10000, outputTokens:1000 }), 2);
  assert.equal(estimateFen({ inputTokens:0, outputTokens:0 }), 0);
  assert.throws(() => estimateFen({ inputTokens:-1, outputTokens:0 }));
  assert.throws(() => estimateFen({ inputTokens:10000, outputTokens:1000000 }));
});
