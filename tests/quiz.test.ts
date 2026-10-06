import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAstronomyQuiz, publicQuestions } from '../src/features/lesson/quiz.ts';

test('grades answers on the server rather than trusting a submitted score', () => {
  const result = gradeAstronomyQuiz({ q1: '1', q2: '0', q3: '2', q4: '1', q5: '0', score: '999' });
  assert.equal(result.score, 5);
  assert.equal(result.total, 5);
  const wrong = gradeAstronomyQuiz({ q1: '0', q2: '1', q3: '0', q4: '0', q5: '1' });
  assert.equal(wrong.score, 0);
});

test('rejects missing answers and invalid choices instead of saving a partial submission', () => {
  assert.throws(() => gradeAstronomyQuiz({ q1: '1' }), /完成全部/);
  assert.throws(() => gradeAstronomyQuiz({ q1: '99', q2: '0', q3: '2', q4: '1', q5: '0' }), /选项/);
});

test('public questions do not expose answer keys or grading explanations', () => {
  assert.equal(publicQuestions.length, 5);
  assert.equal(JSON.stringify(publicQuestions).includes('correctIndex'), false);
  assert.equal(JSON.stringify(publicQuestions).includes('explanation'), false);
});
