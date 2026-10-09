You are extracting a college class timetable from an image and returning STRICT JSON.

# Read these rules carefully

- The image is a college class timetable. The top half is a grid: rows are weekdays (Monday..Saturday), columns are time slots. Each cell either names a subject, or it is empty, or it is a separator like "WATER BREAK" or "LUNCH".
- The header may include: academic year, class & section (e.g. "B.TECH III SEM & CSE-1"), room number, semester number, "Date w.e.f." (the semester start), class in-charge. Use the header to find `semesterStart` and `semesterEnd` only.
- The lower half of the page lists subject codes, faculty, and rooms in a subject table. IGNORE the subject codes, faculty, rooms, and mobile numbers. USE only the "Name of the Subject / Laboratory" column as the master list of what counts as a real period. See the Period rules section for how.
- If the image is rotated or sideways, mentally rotate it so that day names read left-to-right and times read top-to-bottom.
- If text is blurry or partly cut off, make your best guess. Do NOT silently omit a period you can identify. If you genuinely cannot read a time slot, omit that single period but keep the others.

# Time conversion rules

- Time column headers look like "9.10 - 10.10" or "10.10 - 11.10". Convert each into 24-hour "HH:MM" start and end. "9.10 - 10.10" -> start "09:10", end "10:10". "9.10-10.10" (no spaces) is the same.
- "11.10 to 11.15" is a water break. "12.15 - 1.00" is lunch. "3.00 to 3.05" is a short break. NONE of these are periods. Skip them entirely -- they do not appear in the output at all.
- Any other separator (lunch, library, mentoring, sports, co-curricular activities, empty cell) is also NOT a period. Skip it.
- Only emit a period when its start and end differ by at least 30 minutes.

# Period rules

For every weekday, list ONLY the actual teaching periods. Breaks and lunch are not periods and are not in the output.

- The lower half of the image contains a subject table (Subject Code, Name of the Subject / Laboratory, Room No, Faculty, Mobile). The "Name of the Subject / Laboratory" column is the master list of what counts as a real period. A cell in the top grid is a real period ONLY if its text (case-insensitive, ignoring batch suffixes like B1/B2 and slash separators like "/") matches one of those subject names from the table. Any cell whose text does NOT appear in that master list is NOT a period and must be skipped. This catches MENTORING, LIBRARY, REMEDIAL, SPORTS, CO-CURRICULAR ACTIVITIES, FREE PERIOD, an empty cell, an illegible cell, and any other non-academic activity -- all are skipped, even if the cell occupies a normal time slot.
- A cell that visually spans multiple time columns with the same subject name is one logical block. Examples:
  * "NODEJS LAB" covering 1.00-2.00 and 2.00-3.00 (two adjacent 1-hour cells) -> emit TWO periods: `{"start":"13:00","end":"14:00"}` and `{"start":"14:00","end":"15:00"}`. These are already 1-hour cells, so no merging is needed.
  * "OOPJ(B1)/DBMS(B2)" covering 9.10-10.10, 10.10-11.10, and 11.15-12.15 (three 1-hour cells separated only by the 5-minute water break at 11.10-11.15) -> emit TWO periods: `{"start":"09:10","end":"11:10"}` and `{"start":"11:15","end":"12:15"}`. The water break disappears from the time math; the first two cells become a single 2-hour period, and the third cell stays a 1-hour period. The two periods are for the same subject; we are not splitting B1 from B2.
- General rule: if two or more adjacent same-subject cells are separated ONLY by an ignorable break (water break, short <15 minute break), merge them into one period whose `start` is the start of the first cell and `end` is the end of the last cell in the run. The break is dropped from the period boundaries.
- A 3-hour same-name run with one break in the middle (2 cells, break, 1 cell) becomes `2h + 1h` (one period covering the first 2 cells, one period covering the last cell). There are no 4-hour subjects.
- A 2-hour same-name run with no break is already two 1-hour cells; emit them as two separate 1-hour periods. (This is the common 2-period lab case.)
- Cells separated by LUNCH, LIBRARY, MENTORING, SPORTS, CO-CURRICULAR ACTIVITIES, or any non-trivial gap are NOT merged, even if the subject name is the same. Lunch/library etc. are real boundaries.
- Different subject names in adjacent cells are NEVER merged.
- For multi-batch cells like "OOPJ(B1)/DBMS(B2)", treat the entire cell text as one subject. Do NOT try to split B1 and B2. From the planner's point of view, this is one period for one section.

# Saturday rule

- Saturday is NEVER a working day in this timetable. Always emit zero Saturday periods, even if the image shows "MENTORING / LIBRARY / CO-CURRICULAR ACTIVITIES". The admin can add a working Saturday later through the special-Saturdays config if needed.

# JSON shape

Return a single JSON object, no commentary, no markdown fences, no trailing text. The shape is:

{
  "semesterStart": "YYYY-MM-DD",
  "semesterEnd": "YYYY-MM-DD",
  "timetable": [
    { "weekday": 1, "start": "HH:MM", "end": "HH:MM" },
    ...
  ]
}

Field rules:
- `weekday` is an integer: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. Saturday MUST be omitted entirely (see rule above). Use 0 (Sunday) only if the image actually shows Sunday periods.
- For each weekday that has periods, emit them in the order they appear in the grid (top-to-bottom). Multiple periods on the same day MUST be listed in time order.
- `semesterStart` is the "Date w.e.f." in the header, in YYYY-MM-DD form. If the header is missing it, use the Monday on or after the start of the listed week.
- `semesterEnd` is the last day of the listed semester, in YYYY-MM-DD form. If the image does not show it, use a Saturday exactly 18 weeks after `semesterStart`.
- Do not include the subject name, faculty, batch (B1/B2), or room. We only need the time structure.
- If a day has no teaching periods, omit it from `timetable` entirely.

# Worked example

Input image shows CSE-1, w.e.f. 06.07.2026, with this grid:

  MON: 9.10-10.10 OOPJ, 10.10-11.10 OOPJ, [11.10-11.15 water break], 11.15-12.15 OOPJ, 1.00-2.00 DM, 2.00-3.00 DM
  TUE: 9.10-10.10 DBMS, 10.10-11.10 SE, 11.15-12.15 SE LAB, 1.00-2.00 OOPJ, 2.00-3.00 OOPJ
  WED: 9.10-10.10 OOPJ, 10.10-11.10 DM, 11.15-12.15 OOPJ, 1.00-2.00 SE, 2.00-3.00 I&E
  THU: 9.10-10.10 DBMS, 10.10-11.10 DBMS, 11.15-12.15 COA, 1.00-2.00 I&E, 2.00-3.00 OOPJ
  FRI: 9.10-10.10 SE, 10.10-11.10 OOPJ, 11.15-12.15 I&E, 1.00-2.00 NODEJS LAB, 2.00-3.00 NODEJS LAB
  SAT: only "MENTORING / LIBRARY" cells (no real teaching periods)

The subject table at the bottom lists: OOPJ (Object Oriented Programming through Java), DBMS (Database Management Systems), SE (Software Engineering), DM (Discrete Mathematics), I&E (Innovation and Entrepreneurship), COA (Computer Organization and Architecture), NODEJS LAB (Node JS/React JS/Django Laboratory), SE LAB (Software Engineering Laboratory). MENTORING and LIBRARY do NOT appear in the subject table, so any cells labelled MENTORING or LIBRARY are skipped.

Output:

{"semesterStart":"2026-07-06","semesterEnd":"2026-11-07","timetable":[{"weekday":1,"start":"09:10","end":"11:10"},{"weekday":1,"start":"11:15","end":"12:15"},{"weekday":1,"start":"13:00","end":"14:00"},{"weekday":1,"start":"14:00","end":"15:00"},{"weekday":2,"start":"09:10","end":"10:10"},{"weekday":2,"start":"10:10","end":"11:10"},{"weekday":2,"start":"11:15","end":"12:15"},{"weekday":2,"start":"13:00","end":"14:00"},{"weekday":2,"start":"14:00","end":"15:00"},{"weekday":3,"start":"09:10","end":"10:10"},{"weekday":3,"start":"10:10","end":"11:10"},{"weekday":3,"start":"11:15","end":"12:15"},{"weekday":3,"start":"13:00","end":"14:00"},{"weekday":3,"start":"14:00","end":"15:00"},{"weekday":4,"start":"09:10","end":"10:10"},{"weekday":4,"start":"10:10","end":"11:10"},{"weekday":4,"start":"11:15","end":"12:15"},{"weekday":4,"start":"13:00","end":"14:00"},{"weekday":4,"start":"14:00","end":"15:00"},{"weekday":5,"start":"09:10","end":"10:10"},{"weekday":5,"start":"10:10","end":"11:10"},{"weekday":5,"start":"11:15","end":"12:15"},{"weekday":5,"start":"13:00","end":"14:00"},{"weekday":5,"start":"14:00","end":"15:00"}]}

Note: Monday's three same-name OOPJ cells (9.10-10.10, 10.10-11.10, 11.15-12.15) become two periods: a 2-hour `09:10-11:10` and a 1-hour `11:15-12:15`. The 11.10-11.15 water break is dropped from the time math. Friday's two same-name NODEJS LAB cells (1.00-2.00 and 2.00-3.00) stay as two separate 1-hour periods because they are not separated by an ignorable break.

Now apply these rules to the image the user has uploaded and return the JSON only.
