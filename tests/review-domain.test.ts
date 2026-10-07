import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyCard,fsrs,Rating} from 'ts-fsrs';
import {scheduleReview,reviewParameters} from '../src/features/review/domain.ts';

test('FSRS schedules the server grade, never upgrades a wrong answer through self-rating',()=>{
  const now=new Date('2026-10-07T00:00:00Z'),card=createEmptyCard(now);
  const question={prompt:'太阳属于哪类天体？',options:['恒星','行星','卫星'],correctIndex:0,explanation:'太阳是恒星。',sources:[]};
  const wrong=scheduleReview(question,card,'1','easy',now);
  assert.equal(wrong.correct,false);assert.equal(wrong.rating,Rating.Again);
  assert.deepEqual(wrong.scheduled,fsrs(reviewParameters).next(card,now,Rating.Again));
  const right=scheduleReview(question,card,'0','good',now);
  assert.equal(right.correct,true);assert.equal(right.rating,Rating.Good);
  assert.deepEqual(right.scheduled,fsrs(reviewParameters).next(card,now,Rating.Good));
  assert.equal(reviewParameters.request_retention,.9);
  for(const answer of ['-1','3','0.0','true','',null])assert.throws(()=>scheduleReview(question,card,answer,'easy',now),/复习/);
  assert.throws(()=>scheduleReview(question,card,'0','hacked',now),/复习/);
  const later=new Date(right.scheduled.card.due.getTime()+86400000);
  const repeated=scheduleReview(question,JSON.parse(JSON.stringify(right.scheduled.card)),'0','hard',later);
  assert.equal(repeated.scheduled.card.reps,2);assert.equal(repeated.rating,Rating.Hard);
});
