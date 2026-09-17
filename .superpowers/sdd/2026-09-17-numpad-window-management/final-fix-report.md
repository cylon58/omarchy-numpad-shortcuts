# Final review fix wave

Date: 2026-09-17

## Changes

- Updated the ordinary-movement assertion description in `tests/model.test.cjs` to explain that omitting `follow` preserves Omarchy's normal default behavior. The assertion and production code are unchanged.
- Added focused-monitor consolidation coverage in `tests/window-actions.test.lua` using the existing fake Hyprland harness and dispatcher-call observations:
  - An eligible group on the focused monitor moves from workspace 3 to workspace 1 when no lower workspace is owned by another monitor.
  - A lower workspace (ID 2) owned by another monitor blocks consolidation when workspace 1 is already occupied on the focused monitor.

## Verification

Command:

```text
node tests/model.test.cjs
lua tests/window-actions.test.lua
git diff --check
```

Output:

```text
Model shortcut mapping tests passed
window-actions tests: PASS
```

All requested focused suites passed, and `git diff --check` reported no whitespace errors.
