# Backlog

Working list, tackled one at a time. Tick a box when it is done and verified.

## Calculation and logic

- [x] 1. Unreachable target looks like a normal result (100% target at 77.77% shows "0 periods you can bunk … 82.27%" on a yellow card). Detect when the best possible finish is below the target and say so.
- [x] 2. Shown fraction doesn't match shown percentage (`76.87% (264/344)` but 264/344 = 76.74%). Show the exact fraction or drop it.
- [x] 3. Planned bunks are presented as if they already happened ("Updated attendance 98.55% (339/344)", "Held so far 344"). Call it "Projected attendance after your plans", keep "Held so far" to periods that really happened, and explain that planned periods are deducted from the budget (headline 86 → 81).
- [x] 4. "Days you can miss" counts exam days. Decided: exclude exam days.
- [x] 5. "Days you can miss" and "Bunks per week" have no stated rule.
- [x] 6. "334 vs 339" mismatch: caption says 334 held through yesterday, results say 339 after tagging today as Auto. Explain it.
- [x] 7. No semester end date is shown anywhere ("periods left until semester end").
- [x] 8. Integer-only portal % / two-decimal precision. Decided: no change (assume the entered % is accurate; keep the numbers abstract).

## Confusing or misleading UI and wording

- [x] 9. Disabled main button doesn't say why; put the reason next to it.
- [x] 10. No direct "Can I bunk today?" answer. Decided: leave as it is.
- [x] 11. Vocabulary is inconsistent (Bunked / Bunking / Absent / −5 bunked; Attended all / Attend all; Reset all → Clear all / Keep).
- [x] 12. Result card colours (green / yellow / orange / red) are never explained.
- [x] 13. Recovery card is dense; "consecutive" is ambiguous. Say "Don't bunk anything until about <date>".
- [x] 14. Tour doesn't match the product (planned days: struck-through purple outline in the tour, tiny dot in the app). Make planned days easy to spot.
- [x] 15. Past-day dialog has no way to undo a single period / double-count risk when the portal already counted it.
- [x] 16. Tour now waits until a section is picked (the three taps are unchanged).
- [x] 17. Help is in the wrong order: no formula, and the key caveat ("assumes you attend every other period") isn't on the result card.
- [x] 18. Animated counters are mid-count in screenshots and for assistive tech; screen readers read only part of the result.

## Visual and responsive

- [x] 19. Results sit below the fold on mobile; the answer isn't visible right after tapping.
- [x] 20. "Attending" nearly clipped in its button in the tour and day-planner dialogs.
- [x] 21. Muted grey labels are low contrast on cream.
- [x] 22. Calendar legend swatches are hard to tell apart (esp. "Working Sat" vs past days).
- [x] 23. Dialogs appear mid-fade for a moment, which looks like a rendering glitch.
