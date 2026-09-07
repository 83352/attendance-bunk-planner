# Backlog

Deferred improvements — not implemented yet, just tracked here for later.

## UI/UX

## Behavior

- Remember the last-picked section in `localStorage` (device-local, not the URL) so returning users land straight on their inputs instead of re-picking their section every visit. Keep this separate from the existing deliberate choice to ignore `?section=` in the URL on load (`src/app/page.tsx`) — that was about not letting shareable links re-select a section, not about remembering a return visitor's own choice.
