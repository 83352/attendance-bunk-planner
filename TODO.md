# Backlog

Deferred improvements — not implemented yet, just tracked here for later.

## UI/UX

- Calendar's `exam-ink` (`#1b6b5f`, teal-green) and `special-ink`/working-Saturday (`#087d42`, green) are only ~20° apart in hue — close enough that exam days and working-Saturdays can be hard to tell apart at a glance, or for colorblind users, even though each reads fine on its own. Consider a more distinct hue for one of them. (`src/app/styles/tokens.css`)

## Behavior

- Remember the last-picked section in `localStorage` (device-local, not the URL) so returning users land straight on their inputs instead of re-picking their section every visit. Keep this separate from the existing deliberate choice to ignore `?section=` in the URL on load (`src/app/page.tsx`) — that was about not letting shareable links re-select a section, not about remembering a return visitor's own choice.
