# Backlog

Deferred improvements — not implemented yet, just tracked here for later.

## UI/UX

- The "%" unit mark on the attendance inputs is small (16px, Courier New) and can read as two dots rather than a clear percent sign. Bump its size/weight. (`src/app/Calculator.tsx`)
- Recovery Mode's "9 periods" and the hero's "46 periods" are two giant same-size numbers stacked directly on top of each other, answering different questions (short-term: attend for 2 days to cross back over 75%; long-term: then you have a 46-period cushion for the rest of the term) with nothing visually signaling the sequence — can read as contradictory. Needs a visual/textual bridge between the two boxes. (`src/app/Calculator.tsx`, `Results`)
- "Assumes zero bunks from today." sits above both the "9" and "46" numbers but only actually applies to the "9" (recoveryTo75); its placement makes it look like a shared caveat for both. (`src/app/Calculator.tsx`, `Results`)

- Calendar's `exam-ink` (`#1b6b5f`, teal-green) and `special-ink`/working-Saturday (`#087d42`, green) are only ~20° apart in hue — close enough that exam days and working-Saturdays can be hard to tell apart at a glance, or for colorblind users, even though each reads fine on its own. Consider a more distinct hue for one of them. (`src/app/styles/tokens.css`)

## Behavior

- Remember the last-picked section in `localStorage` (device-local, not the URL) so returning users land straight on their inputs instead of re-picking their section every visit. Keep this separate from the existing deliberate choice to ignore `?section=` in the URL on load (`src/app/page.tsx`) — that was about not letting shareable links re-select a section, not about remembering a return visitor's own choice.
