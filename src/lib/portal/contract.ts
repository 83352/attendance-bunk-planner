/**
 * The portal's API is unofficial and can change without notice. These checks
 * confirm each response still has every field dontbunk reads, with the type it
 * expects. If one doesn't, the data can't be trusted, so the whole site shows
 * "under maintenance" instead of a wrong attendance number.
 *
 * Only the fields dontbunk uses are checked, so the portal adding new fields
 * is fine. Messages name the endpoint and field only, never any values.
 */

/** The portal answered, but not in the shape dontbunk was built for (or an endpoint is gone). */
export class PortalContractError extends Error {}

type Check<T> = (value: unknown, path: string) => T;

const fail = (path: string, expected: string): never => {
  throw new PortalContractError(`${path} should be ${expected}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const str: Check<string> = (value, path) => (typeof value === 'string' ? value : fail(path, 'a string'));
const num: Check<number> = (value, path) => (typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a number'));
const bool: Check<boolean> = (value, path) => (typeof value === 'boolean' ? value : fail(path, 'true or false'));

const object = (value: unknown, path: string): Record<string, unknown> => (isRecord(value) ? value : fail(path, 'an object'));
const array = (value: unknown, path: string): unknown[] => (Array.isArray(value) ? value : fail(path, 'a list'));

const field = <T>(record: Record<string, unknown>, key: string, check: Check<T>, path: string): T => check(record[key], `${path}.${key}`);

/** The cheap probe only needs to tell us which semester the student is in. */
export function checkCurrentSemester(body: unknown, path = 'my-all-semester-attendance') {
  return { currentSemNo: field(object(body, path), 'currentSemNo', num, path) };
}

export function checkSemesterSummary(body: unknown, path = 'my-all-semester-attendance') {
  const root = object(body, path);
  return {
    currentSemNo: field(root, 'currentSemNo', num, path),
    subjects: array(root.subjects, `${path}.subjects`).map((item, index) => {
      const itemPath = `${path}.subjects[${index}]`;
      const subject = object(item, itemPath);
      return {
        subjectName: field(subject, 'subjectName', str, itemPath),
        numberOfClasses: field(subject, 'numberOfClasses', num, itemPath),
        present: field(subject, 'present', num, itemPath),
        // Not read by the page (it works the percentage out from the counts).
        absent: typeof subject.absent === 'number' ? subject.absent : 0,
        percentage: typeof subject.percentage === 'number' ? subject.percentage : 0,
      };
    }),
  };
}

export function checkPrimaryAttendance(body: unknown, path = 'my-secondary-attendance') {
  const attendance = object(object(body, path).primaryAttendance, `${path}.primaryAttendance`);
  const at = `${path}.primaryAttendance`;
  return {
    numberOfClasses: field(attendance, 'numberOfClasses', num, at),
    present: field(attendance, 'present', num, at),
    // Only shown in the portal's raw data, never used in a calculation.
    absent: typeof attendance.absent === 'number' ? attendance.absent : 0,
    totalSessionsIncludingActivity: typeof attendance.totalSessionsIncludingActivity === 'number' ? attendance.totalSessionsIncludingActivity : 0,
    percentage: field(attendance, 'percentage', num, at),
  };
}

export function checkTimetableRows(body: unknown, path = 'classroom-timetables') {
  return array(body, path).map((item, index) => {
    const at = `${path}[${index}]`;
    const row = object(item, at);
    const subject = object(row.subject, `${at}.subject`);
    const slot = object(row.timetableSlot, `${at}.timetableSlot`);
    const attendance = row.studentAttendance === null ? null : object(row.studentAttendance, `${at}.studentAttendance`);
    return {
      sessionDate: field(row, 'sessionDate', str, at),
      fromTime: field(row, 'fromTime', str, at),
      toTime: field(row, 'toTime', str, at),
      periods: array(row.periods, `${at}.periods`).map((period) => num(period, `${at}.periods[]`)),
      semNo: field(row, 'semNo', num, at),
      isSuspended: field(row, 'isSuspended', bool, at),
      completed: field(row, 'completed', bool, at),
      subjectId: field(row, 'subjectId', num, at),
      subject: { name: field(subject, 'name', str, `${at}.subject`), subjectCode: field(subject, 'subjectCode', str, `${at}.subject`) },
      faculties: (Array.isArray(row.faculties) ? row.faculties : []).flatMap((faculty) => (isRecord(faculty) && typeof faculty.fullName === 'string' ? [{ fullName: faculty.fullName }] : [])),
      groups: array(row.groups, `${at}.groups`).map((group) => {
        const groupRecord = object(group, `${at}.groups[]`);
        return { id: field(groupRecord, 'id', num, `${at}.groups[]`), name: field(groupRecord, 'name', str, `${at}.groups[]`) };
      }),
      timetableSlot: { day: field(slot, 'day', str, `${at}.timetableSlot`) },
      studentAttendance: attendance ? { status: field(attendance, 'status', bool, `${at}.studentAttendance`) } : null,
    };
  });
}
