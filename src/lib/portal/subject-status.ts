import type { PortalSubjectAttendance } from './campx-client';

export type SubjectRow = {
  name: string;
  attended: number;
  held: number;
  percentage: number;
  belowTarget: boolean;
  /** Classes in a row the student would have to attend to reach the target; null when below a 100% target (any miss is permanent). */
  classesNeeded: number | null;
};

/** The portal's per-subject counts against the student's target, lowest percentage first. */
export function subjectRows(subjects: PortalSubjectAttendance[], targetPercentage: number): SubjectRow[] {
  const target = targetPercentage / 100;
  return subjects
    .map((subject): SubjectRow => {
      const held = subject.numberOfClasses;
      const attended = subject.present;
      const percentage = held === 0 ? 0 : (attended / held) * 100;
      const belowTarget = held > 0 && attended / held < target - 1e-10;
      const classesNeeded = !belowTarget ? 0 : target >= 1 ? null : Math.max(0, Math.ceil((target * held - attended) / (1 - target) - 1e-10));
      return { name: subject.subjectName, attended, held, percentage, belowTarget, classesNeeded };
    })
    .sort((a, b) => a.percentage - b.percentage);
}
