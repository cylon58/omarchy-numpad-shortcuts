
# Numpad Window Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keypad window movement, session-only protection, and global/focused-monitor workspace consolidation to the Numpad Shortcuts plugin.

**Architecture:** Quickshell remains the single service. `Model.js` owns the binding inventory and asks the existing fixed `hyprctl eval` path to load `WindowActions.lua`. The Lua module owns the live protected-address map and executes native Hyprland window moves.

**Tech Stack:** Quickshell QML, JavaScript, Hyprland Lua API, Lua 5.5, Omarchy plugin CLI.

**Spec:** `docs/superpowers/specs/2026-09-17-numpad-window-management-design.md`

## Global Constraints

- Consolidate only ordinary numeric workspaces 1–10. Do not touch named, special, or higher-numbered workspaces.
- Preserve all existing Num Lock-on/off workspace keys and the keypad terminal key.
- Protection is session-only and keyed by a live window address; do not use Hyprland's all-workspace floating-window pin.
- Consolidation sets `follow = false`; normal `Super + Shift + KP` movement uses Omarchy's normal follow behavior.
- Global consolidation can move a group to the target workspace's monitor. Focused-monitor consolidation never targets an ID owned by another monitor.
- Keep the fixed `/usr/bin/hyprctl`, existing minimal environment, and no overlay, daemon, network use, or dependencies.
- Do not push to GitHub or update the marketplace before explicit user approval after local tests.

---

### Task 1: Test and implement native Lua actions

**Files:**

- Create: `WindowActions.lua`
- Create: `tests/window-actions.test.lua`

**Interfaces:**

- Produces global `NumpadShortcuts` with `protected`, `toggleProtection()`, `consolidateGlobal()`, and `consolidateFocusedMonitor()`.
- Consumes `hl.get_active_window()`, `hl.get_windows()`, `hl.get_workspaces()`, `hl.get_active_monitor()`, `hl.dispatch()`, `hl.dsp.window.move()`, and `hl.notification.create()`.
- Is loaded later through `Model.applyScript(pluginLuaPath)`.

- [ ] **Step 1: Write failing executable Lua behavior tests**

Create `tests/window-actions.test.lua`. Install a fake `hl` before loading the module: `hl.dsp.window.move(options)` returns `{ kind = "move", options = options }`; `hl.dispatch(dispatcher)` captures dispatches; and `hl.notification.create(options)` captures notification text. Each fixture must reset `NumpadShortcuts = nil`, install fake windows/workspaces/monitor state, then load `WindowActions.lua`.

Define `win(address, workspace_id, monitor, special)` to return an object containing `address`, `monitor`, and `workspace = { id = workspace_id, monitor = monitor, special = special or false }`. Use literal tests:

```lua
local a, b = { id = 1, name = "DP-1" }, { id = 2, name = "HDMI-A-1" }

fixture({ active = win("0xaaa", 5, a), windows = { win("0xaaa", 5, a) } })
NumpadShortcuts.toggleProtection()
assert(NumpadShortcuts.protected["0xaaa"] == true)
NumpadShortcuts.toggleProtection()
assert(NumpadShortcuts.protected["0xaaa"] == nil)

fixture({ windows = { win("0x1", 1, a), win("0x3a", 3, a), win("0x3b", 3, a) } })
NumpadShortcuts.consolidateGlobal()
assert_moves({ { "0x3a", 2, false }, { "0x3b", 2, false } })

fixture({
  protected = { ["0xpin"] = true },
  windows = { win("0x1", 1, a), win("0xpin", 3, a), win("0xmove", 3, a) }
})
NumpadShortcuts.consolidateGlobal()
assert_moves({ { "0xmove", 2, false } })

fixture({
  active_monitor = a,
  windows = { win("0x1", 1, a), win("0x3", 3, a), win("0x2", 2, b) }
})
NumpadShortcuts.consolidateFocusedMonitor()
assert_moves({})
```

Add independent checks that: no focused window produces no protection entry and one notification; stale addresses are pruned; a no-op reports a notification; and special workspace windows are not moved. These tests catch a no-op protection implementation, a missing `follow=false`, movement of a protected window, and cross-monitor destination selection.

Run:

```bash
lua tests/window-actions.test.lua
```

Expected: FAIL because `WindowActions.lua` does not exist.

- [ ] **Step 2: Implement `WindowActions.lua`**

Begin with:

```lua
NumpadShortcuts = NumpadShortcuts or { protected = {} }
NumpadShortcuts.protected = NumpadShortcuts.protected or {}

local function notify(text)
  hl.notification.create({ text = text, timeout = 2000 })
end

local function move(window, workspace)
  hl.dispatch(hl.dsp.window.move({ window = window, workspace = workspace, follow = false }))
end
```

Implement `toggleProtection()` to get the active window, toggle `protected[window.address]`, and notify exactly `Window protected from consolidation`, `Window can move during consolidation`, or `No focused window to protect`.

Implement a shared planner with this exact contract:

1. Read every window from `hl.get_windows()` and create a live-address set before applying any workspace filter.
2. Remove every protection entry absent from that complete live-address set, then filter the windows to non-special entries whose `window.workspace.id` is an integer from 1 through 10.
3. Visit source IDs 1 through 10. Treat every unprotected source's windows as a group; reserve a source ID containing any protected window.
4. Maintain target IDs that are reserved or retained/filled by an earlier group. For a group, choose the lowest unblocked ID strictly lower than its source. If none exists, retain it at its source.
5. Dispatch every window in a moved group through `move(window, target_id)` and count windows.

`consolidateGlobal()` passes all filtered windows into this planner. `consolidateFocusedMonitor()` requires `hl.get_active_monitor()`, passes only windows whose `window.monitor == active_monitor`, and blocks every ID returned by `hl.get_workspaces()` whose `workspace.monitor ~= active_monitor`. A missing active monitor notifies and returns. Both commands report `Workspaces are already compact` for zero moves and `Consolidated N window(s)` otherwise.

- [ ] **Step 3: Verify the Lua suite is green**

Run:

```bash
lua tests/window-actions.test.lua
```

Expected: PASS, including global packing, protected gaps, and focused-monitor isolation.

- [ ] **Step 4: Commit**

```bash
git add WindowActions.lua tests/window-actions.test.lua
git commit -m "feat: add protected workspace consolidation"
```

### Task 2: Add keypad bindings and module loading

**Files:**

- Modify: `Model.js:1-97`
- Modify: `Service.qml:9-33`
- Modify: `tests/model.test.cjs:1-47`

**Interfaces:**

- Consumes the Task 1 `NumpadShortcuts` functions.
- Produces binding entries `{ modifiers, key, description, dispatcher, argument? }` and `applyScript(pluginLuaPath)`.
- `bindingsAreActive(output)` returns true only when all new sentinel descriptions exist.

- [ ] **Step 1: Extend Node assertions and watch them fail**

Update `tests/model.test.cjs` with these assertions:

```javascript
assert.equal(bindings.length, 44);
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "move" && binding.argument === "1")
    .map((binding) => [binding.modifiers, binding.key]),
  [["SUPER + SHIFT", "KP_1"], ["SUPER + SHIFT", "KP_End"]]
);
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "callback")
    .map((binding) => [binding.modifiers, binding.key, binding.argument]),
  [
    ["SUPER + CTRL", "KP_Enter", "NumpadShortcuts.toggleProtection"],
    ["SUPER + CTRL + SHIFT", "KP_Enter", "NumpadShortcuts.consolidateGlobal"],
    ["SUPER + CTRL + SHIFT + ALT", "KP_Enter", "NumpadShortcuts.consolidateFocusedMonitor"]
  ]
);
```

Assert `applyScript("/tmp/WindowActions.lua")` emits a Lua-escaped `dofile('/tmp/WindowActions.lua')` before it registers callbacks, emits `hl.dsp.window.move({ workspace = "1" })` for ordinary movement, and produces 44 cleanup unbinds. Assert `bindingsAreActive()` requires all five descriptions:

```javascript
[
  "Open terminal",
  "Move window to workspace 1",
  "Toggle window consolidation protection",
  "Consolidate workspaces on all monitors",
  "Consolidate workspaces on focused monitor"
]
```

Run:

```bash
node tests/model.test.cjs
```

Expected: FAIL because the current model has 21 bindings and no callbacks.

- [ ] **Step 2: Implement the binding integration**

In `Model.js`, add `modifiers` to every binding. Retain two `workspace` entries per ID with `SUPER`; add two `move` entries with `SUPER + SHIFT`; retain terminal as `exec`; add the three exact `callback` entries above.

Add and use for both binding and cleanup output:

```javascript
function bindingKeys(binding) {
  return binding.modifiers + " + " + binding.key;
}
```

Change `applyScript(pluginLuaPath)` to begin with:

```javascript
[
  'hl.config({ ["input.numlock_by_default"] = true })',
  "dofile('" + pluginLuaPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "')"
]
```

Generate `hl.dsp.focus`, `hl.dsp.window.move`, `hl.dsp.exec_cmd`, or the callback expression by dispatcher. Do not pass `follow` for normal keypad moves. Require all five sentinel descriptions in `bindingsAreActive`.

In `Service.qml`, add:

```qml
readonly property string windowActionsPath: Quickshell.env("HOME")
  + "/.config/omarchy/plugins/cylon58.numpad-shortcuts/WindowActions.lua"
```

Pass `root.windowActionsPath` to `Model.applyScript(...)`. Do not modify the executable path, environment, timeout, serialized apply behavior, or polling interval.

- [ ] **Step 3: Verify all automated behavior**

Run:

```bash
lua tests/window-actions.test.lua
node tests/model.test.cjs
```

Expected: both PASS with no warnings.

- [ ] **Step 4: Commit**

```bash
git add Model.js Service.qml tests/model.test.cjs
git commit -m "feat: bind numpad window management actions"
```

### Task 3: Release metadata, validation, and local test staging

**Files:**

- Modify: `manifest.json:5,8`
- Modify: `README.md:5-48`
- Modify: `tests/model.test.cjs`
- Modify after validation: `/home/geoff/.config/omarchy/plugins/cylon58.numpad-shortcuts/{Model.js,Service.qml,WindowActions.lua,README.md,manifest.json}`
- Modify after successful manual verification: `/home/geoff/.config/omarchy/SYSTEM-CHANGES.md`, `/home/geoff/Work/SYSTEM-CHANGES.md`

**Interfaces:**

- Delivers manifest version `0.2.0` and a locally testable plugin.
- Does not push or publish.

- [ ] **Step 1: Write failing release-metadata tests**

In `tests/model.test.cjs`, parse `manifest.json` and `README.md`. Assert manifest version is `0.2.0`; assert all four new literal shortcut strings are present; and assert the README states protection is session-only. These checks catch an incomplete feature release rather than arbitrary prose edits.

Run:

```bash
node tests/model.test.cjs
```

Expected: FAIL because version is `0.1.1` and the README lacks the new controls.

- [ ] **Step 2: Update manifest and README**

Set version to `0.2.0`; update the manifest description to mention switching, moving, and consolidation.

Add a **Window management** table:

| Shortcut | Action |
| --- | --- |
| `Super + Shift + keypad 1–0` | Move the focused window to workspace 1–10. |
| `Super + Ctrl + keypad Enter` | Toggle session-only protection for the focused window. |
| `Super + Ctrl + Shift + keypad Enter` | Consolidate numeric workspaces 1–10 across monitors. |
| `Super + Ctrl + Shift + Alt + keypad Enter` | Consolidate the focused monitor without taking IDs owned by another monitor. |

State that protected windows remain, unprotected neighbors can move, gaps can be intentional, consolidation is silent, and protection ends with the window or Hyprland. Retain the security boundary and state that the same fixed evaluation path loads this plugin's Lua module.

- [ ] **Step 3: Run complete validation**

Run:

```bash
lua tests/window-actions.test.lua
node tests/model.test.cjs
omarchy plugin validate .
git diff --check
```

Expected: all pass and plugin validation reports no manifest or entry-point failure.

- [ ] **Step 4: Commit**

```bash
git add manifest.json README.md tests/model.test.cjs
git commit -m "docs: describe numpad window management"
```

- [ ] **Step 5: Stage and manually verify the local plugin**

Copy only validated runtime files (`Model.js`, `Service.qml`, `WindowActions.lua`, `README.md`, `manifest.json`) with `install -m 0644` into the existing active plugin directory. Do not copy `.git`, tests, or plans. Rescan:

```bash
omarchy-shell shell rescanPlugins
```

Verify:

1. `Super + Shift + KP 1` and its Num Lock-off equivalent move a focused test window.
2. Protect a focused window, create a gap, run global consolidation, and confirm it remains.
3. Add an unprotected neighbor to a protected workspace; confirm only the neighbor moves.
4. With two monitors, compare global consolidation with the Alt-modified action; confirm the latter never uses an ID owned by the other monitor.
5. Run `hyprctl reload`, wait for the probe, and repeat a new shortcut.

Only after all checks succeed, append a dated journal entry naming the active plugin path, version `0.2.0`, new shortcuts, and rollback (`omarchy plugin update cylon58.numpad-shortcuts` after publication or restore prior runtime files). Reconcile journals and require:

```bash
cmp -s /home/geoff/.config/omarchy/SYSTEM-CHANGES.md /home/geoff/Work/SYSTEM-CHANGES.md
```

Report the local test handoff; do not push or publish.
