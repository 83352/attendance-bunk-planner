import { describe, expect, it } from 'vitest';
import { checkCurrentSemester, checkPrimaryAttendance, checkSemesterSummary, checkTimetableRows, PortalContractError } from './contract';

// Trimmed copies of what the portal returns today. If the portal changes shape,
// the matching `rejects` case below shows what dontbunk would treat as "under maintenance".
const row = {
  sessionDate: '2026-10-12', fromTime: '09:00:00', toTime: '09:50:00', periods: [1], semNo: 3,
  isSuspended: false, completed: true, subjectId: 7,
  subject: { name: 'Maths', subjectCode: 'MA101' },
  faculties: [{ fullName: 'A. Teacher' }],
  groups: [{ id: 1, name: 'BATCH 1' }],
  timetableSlot: { day: 'MONDAY' },
  studentAttendance: { status: false },
  somethingNew: 'extra fields are fine',
};
const primary = { primaryAttendance: { numberOfClasses: 100, present: 80, absent: 20, totalSessionsIncludingActivity: 100, percentage: 80 } };
const summary = { currentSemNo: 3, subjects: [{ subjectName: 'Maths', numberOfClasses: 10, present: 8, absent: 2, percentage: 80 }] };

describe('portal response checks', () => {
  it('accepts today’s response shapes, including extra fields and ungraded sessions', () => {
    expect(checkTimetableRows([row, { ...row, studentAttendance: null }])).toHaveLength(2);
    expect(checkPrimaryAttendance(primary).percentage).toBe(80);
    expect(checkSemesterSummary(summary).subjects).toHaveLength(1);
    expect(checkCurrentSemester(summary).currentSemNo).toBe(3);
  });

  it('does not require fields dontbunk never reads', () => {
    expect(checkTimetableRows([{ ...row, faculties: undefined }])[0].faculties).toEqual([]);
    expect(checkPrimaryAttendance({ primaryAttendance: { numberOfClasses: 1, present: 1, percentage: 100 } }).absent).toBe(0);
  });

  it.each([
    ['a timetable that is no longer a list', () => checkTimetableRows({ rows: [row] })],
    ['a renamed session date', () => checkTimetableRows([{ ...row, sessionDate: undefined, date: '2026-10-12' }])],
    ['periods that are no longer numbers', () => checkTimetableRows([{ ...row, periods: ['1'] }])],
    ['a missing subject', () => checkTimetableRows([{ ...row, subject: null }])],
    ['attendance status that is no longer a boolean', () => checkTimetableRows([{ ...row, studentAttendance: { status: 'ABSENT' } }])],
    ['attendance moved under another name', () => checkPrimaryAttendance({ attendance: primary.primaryAttendance })],
    ['a percentage sent as text', () => checkPrimaryAttendance({ primaryAttendance: { ...primary.primaryAttendance, percentage: '80%' } })],
    ['no current semester', () => checkCurrentSemester({ semester: 3 })],
    ['subjects missing', () => checkSemesterSummary({ currentSemNo: 3 })],
    ['a subject whose counts changed type', () => checkSemesterSummary({ currentSemNo: 3, subjects: [{ subjectName: 'Maths', numberOfClasses: '10', present: 8 }] })],
    ['an empty response', () => checkTimetableRows(null)],
  ])('rejects %s', (_label, run) => {
    expect(run).toThrow(PortalContractError);
  });

  it('names where the problem is without including any values', () => {
    expect(() => checkTimetableRows([row, { ...row, semNo: 'secret value' }])).toThrow('classroom-timetables[1].semNo should be a number');
    try { checkTimetableRows([{ ...row, semNo: 'secret value' }]); } catch (error) { expect((error as Error).message).not.toContain('secret value'); }
  });
});
