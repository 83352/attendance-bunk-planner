import { describe, expect, it } from 'vitest';
import { answerKey, parseAnswers, pruneAnswers } from './saved-answers';

describe('answerKey', () => {
  it('is stable for the same period and distinct across periods', () => {
    const a = { date: '2026-10-09', fromTime: '09:10:00', subjectName: 'Software Engineering' };
    expect(answerKey(a)).toBe(answerKey({ ...a }));
    expect(answerKey(a)).not.toBe(answerKey({ ...a, fromTime: '10:10:00' }));
    expect(answerKey(a)).not.toBe(answerKey({ ...a, subjectName: 'Discrete Mathematics' }));
  });
});

describe('parseAnswers', () => {
  it('reads valid answers', () => {
    expect(parseAnswers('{"a":"attended","b":"bunked"}')).toEqual({ a: 'attended', b: 'bunked' });
  });
  it('drops unusable entries and survives garbage', () => {
    expect(parseAnswers('{"a":"attended","b":"maybe","c":1}')).toEqual({ a: 'attended' });
    expect(parseAnswers('not json')).toEqual({});
    expect(parseAnswers('[1,2]')).toEqual({});
    expect(parseAnswers(null)).toEqual({});
  });
});

describe('pruneAnswers', () => {
  it('drops answers for periods the portal has since graded', () => {
    expect(pruneAnswers({ a: 'attended', b: 'bunked' }, ['b'])).toEqual({ b: 'bunked' });
  });
});
