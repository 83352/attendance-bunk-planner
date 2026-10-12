import { describe, expect, it } from 'vitest';
import { subjectRows } from './subject-status';

const subject = (subjectName: string, present: number, numberOfClasses: number) => ({ subjectName, present, numberOfClasses, absent: numberOfClasses - present, percentage: 0 });

describe('subjectRows', () => {
  const rows = subjectRows([subject('Good', 40, 50), subject('DBMS', 11, 19), subject('Env', 18, 26)], 75);

  it('sorts lowest percentage first', () => {
    expect(rows.map((row) => row.name)).toEqual(['DBMS', 'Env', 'Good']);
  });
  it('flags subjects below the target and says how many classes in a row fix it', () => {
    // DBMS: 11/19 = 57.9%. Need (0.75*19 - 11)/0.25 = 13.
    expect(rows[0]).toMatchObject({ belowTarget: true, classesNeeded: 13 });
    expect(rows[0].percentage).toBeCloseTo(57.89, 1);
    expect(rows[2]).toMatchObject({ belowTarget: false, classesNeeded: 0 });
  });
  it('follows the typed target', () => {
    expect(subjectRows([subject('Good', 40, 50)], 90)[0].belowTarget).toBe(true);
    expect(subjectRows([subject('Good', 40, 50)], 70)[0].belowTarget).toBe(false);
  });
  it('handles a subject with no classes yet', () => {
    expect(subjectRows([subject('New', 0, 0)], 75)[0]).toMatchObject({ percentage: 0, belowTarget: false });
  });
});
