# Numpad Shortcuts Guide Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Omarchy guide panel that teaches Numpad Shortcuts with prose, a drawn workspace illustration, an expandable exact shortcut list, an opt-in launcher entry, and `Super + Ctrl + KP Divide`.

**Architecture:** Keep the current service responsible for dynamically installing Hyprland bindings. Add a co-located `panel` entry point summoned by Omarchy Shell IPC, with its full list derived from `Model.js`. The panel uses fixed, opt-in helpers to create a marked desktop entry and never writes one merely by opening.

**Tech Stack:** Quickshell/QML, Hyprland Lua bindings, QML JavaScript, POSIX shell, Node assertion tests, Lua test harness, Omarchy plugin validator.

**Spec:** `docs/superpowers/specs/2026-09-17-numpad-guide-design.md`

## Global Constraints

- Keep one plugin package and one existing Quickshell service; add no daemon, browser process, persistent protection store, or fullscreen overlay.
- The guide is a normal `FloatingWindow`, closes with Escape/Close/window close, and performs no workspace action merely by opening.
- `Super + Ctrl + KP Divide` toggles the guide; existing bindings remain unchanged.
- Treat prose as authoritative: the bundled raster illustration contains no shortcut instructions and has accessible text equivalents in QML.
- Full shortcuts list derives from the canonical `Model.js` bindings inventory.
- Never write `~/.local/share/applications` without the guide user's explicit confirmation; never overwrite an entry without the plugin ownership marker.
- Helper scripts accept no arbitrary executable, command, or destination path from QML.
- Keep scratch `.superpowers/brainstorm/` files out of commits.
- Do not push or alter the marketplace request until the user visually tests and explicitly authorizes publication.

---

### Task 1: Canonical guide shortcut data and dynamic guide binding

**Files:**
- Modify: `Model.js`
- Modify: `tests/model.test.cjs`

**Interfaces:**
- Produces: `Model.guideSections() -> Array<{ title, summary, shortcuts, details }>` for `Guide.qml`.
- Produces: one binding `{ modifiers: "SUPER + CTRL", key: "KP_Divide", description: "Open Numpad Shortcuts guide", dispatcher: "guide" }`.
- Consumes: the existing `bindings()`, `applyScript()`, `cleanupScript()`, and `bindingsAreActive()` functions.

- [ ] **Step 1: Write the failing model tests**

  Extend `tests/model.test.cjs` with the expected guide binding and sections:

  ```js
  assert.equal(bindings.length, 45);
  assert.deepEqual(bindings.at(-1), {
    modifiers: "SUPER + CTRL",
    key: "KP_Divide",
    description: "Open Numpad Shortcuts guide",
    dispatcher: "guide",
    argument: ""
  });
  assert.equal(Model.bindingsAreActive(JSON.stringify([
    { description: "Open terminal" },
    { description: "Move window to workspace 1" },
    { description: "Toggle window consolidation protection" },
    { description: "Consolidate workspaces on all monitors" },
    { description: "Consolidate workspaces on focused monitor" },
    { description: "Open Numpad Shortcuts guide" }
  ])), true);
  assert.deepEqual(Model.guideSections().map(section => section.title), [
    "Switch focus", "Move a window", "Protect a window", "Consolidate gaps"
  ]);
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/model.test.cjs`

  Expected: failure because the binding count is still 44 and `guideSections` is undefined.

- [ ] **Step 3: Implement canonical guide data and binding**

  In `Model.js`, append the guide binding after the existing management actions with dispatcher `guide` and no filesystem path. Change the signature to `applyScript(pluginLuaPath, guideLauncherPath)`: its `guide` branch emits `hl.dsp.exec_cmd` only from the QML-supplied absolute helper path. Add `guideSections()` that reads `bindings()` and returns the four concept cards, each using filter-selected canonical binding descriptions rather than handwritten shortcut arrays. Use text matching the approved spec, including that move sends the focused window to a target workspace and protected windows are session-only.

  Update `bindingsAreActive()` to require `Open Numpad Shortcuts guide`, and export `guideSections` for both QML and Node tests. In `Service.qml`, add `guideLauncherPath` from `Quickshell.env("HOME")` and pass it to `Model.applyScript`; this keeps all user-specific paths out of canonical model data.

- [ ] **Step 4: Run the model test to verify it passes**

  Run: `node tests/model.test.cjs`

  Expected: `Model shortcut mapping tests passed`.

- [ ] **Step 5: Commit the canonical binding work**

  ```bash
  git add Model.js tests/model.test.cjs
  git commit -m "feat: add numpad guide binding data"
  ```

### Task 2: Safe opt-in launcher helper

**Files:**
- Create: `bin/open-guide`
- Create: `bin/manage-launcher-entry`
- Create: `tests/launcher-entry.test.sh`

**Interfaces:**
- `bin/open-guide`: takes no arguments; invokes the fixed `cylon58.numpad-shortcuts` shell panel summon.
- `bin/manage-launcher-entry install|remove`: performs only the named operation against `cylon58-numpad-shortcuts-guide.desktop` below `${XDG_DATA_HOME:-$HOME/.local/share}/applications`.
- Produces: desktop entries carrying `X-Omarchy-Numpad-Shortcuts-Guide=true` ownership marker.

- [ ] **Step 1: Write the failing launcher-helper test**

  Create `tests/launcher-entry.test.sh` with an isolated temporary `HOME` and `XDG_DATA_HOME`. Assert the initial install creates the exact marked entry, a second install is idempotent, an unmarked pre-existing entry is byte-for-byte unchanged and returns nonzero, and removal deletes only a marked entry:

  ```bash
  "$helper" install
  grep -qx 'X-Omarchy-Numpad-Shortcuts-Guide=true' "$entry"
  cp "$entry" "$tmp/owned-before"
  "$helper" install
  cmp "$tmp/owned-before" "$entry"
  printf '[Desktop Entry]\nName=Custom\n' >"$entry"
  ! "$helper" install
  grep -qx 'Name=Custom' "$entry"
  ! "$helper" remove
  grep -qx 'Name=Custom' "$entry"
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `bash tests/launcher-entry.test.sh`

  Expected: failure because `bin/manage-launcher-entry` does not exist.

- [ ] **Step 3: Implement fixed-argument helpers**

  Implement `bin/open-guide` as POSIX shell with `set -eu`, reject any argument, default only `OMARCHY_PATH` to `/usr/share/omarchy`, then `exec /usr/bin/omarchy-shell shell summon cylon58.numpad-shortcuts`.

  Implement `bin/manage-launcher-entry` with `set -eu`, accept only `install` or `remove`, set the fixed entry path from the standard XDG location, and define a constant marker. `install` must make the applications directory, refuse existing unmarked entries, write a `mktemp` file with mode 600, then atomically rename it with mode 644. The desktop entry contains only:

  Compute the helper path relative to the helper script's own resolved plugin directory; do not embed a specific username:

  ```bash
  script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
  plugin_dir=$(CDPATH= cd -- "$script_dir/.." && pwd -P)
  entry_exec="$plugin_dir/bin/open-guide"
  ```

  The generated entry uses `Exec=$entry_exec` and contains only these fields:

  ```ini
  [Desktop Entry]
  Type=Application
  Name=Numpad Shortcuts
  Comment=Learn Numpad Shortcuts for Omarchy workspaces
  Exec=$entry_exec
  Terminal=false
  NoDisplay=false
  X-Omarchy-Numpad-Shortcuts-Guide=true
  ```

  `remove` succeeds only for a marked entry; it leaves absent and unmarked paths untouched with a nonzero status. Do not accept an output location, desktop text, command, or plugin id from the caller.

- [ ] **Step 4: Run the helper test and shell syntax checks**

  Run: `bash tests/launcher-entry.test.sh && bash -n bin/open-guide bin/manage-launcher-entry`

  Expected: exit 0.

- [ ] **Step 5: Commit the launcher helper**

  ```bash
  git add bin/open-guide bin/manage-launcher-entry tests/launcher-entry.test.sh
  git commit -m "feat: add opt-in numpad guide launcher"
  ```

### Task 3: Native QML guide panel and illustration

**Files:**
- Create: `GuideModel.js`
- Create: `Guide.qml`
- Create: `assets/numpad-workspace-concepts.png`
- Create: `tests/guide-model.test.cjs`

**Interfaces:**
- `GuideModel.fullShortcutRows(bindings) -> Array<{ shortcut, action }>`: groups canonical bindings by description and renders Num Lock variants in one readable row.
- `GuideModel.launcherState(exitCode, operation) -> { message, severity }`: maps only the helper's `install`/`remove` result to display text.
- `Guide.qml` receives injected `shell`, `manifest`, and `service` properties from Omarchy Shell's panel loader; calls `shell.hide(manifest.id)` to close.

- [ ] **Step 1: Write failing guide-model tests**

  Create `tests/guide-model.test.cjs`:

  ```js
  const rows = GuideModel.fullShortcutRows(Model.bindings());
  assert.ok(rows.some(row => row.action === "Open Numpad Shortcuts guide" && row.shortcut.includes("Numpad Divide")));
  assert.ok(rows.some(row => row.action === "Move window to workspace 4" && row.shortcut.includes("KP_4") && row.shortcut.includes("KP_Left")));
  assert.equal(GuideModel.launcherState(0, "install").severity, "success");
  assert.equal(GuideModel.launcherState(1, "install").severity, "error");
  ```

  Also load `Guide.qml` as text and assert it contains `FloatingWindow`, an Escape `Shortcut`, `Show full shortcut list`, `Add to launcher`, `visible: root.opened`, and no `Component.onCompleted` call that starts the launcher helper.

- [ ] **Step 2: Run the guide-model test to verify it fails**

  Run: `node tests/guide-model.test.cjs`

  Expected: failure because `GuideModel.js` and `Guide.qml` do not exist.

- [ ] **Step 3: Implement guide model, panel, and final illustration asset**

  Build `GuideModel.fullShortcutRows` from `Model.bindings()` by grouping same-description bindings and formatting exact modifiers/key names; never hard-code a second inventory. Map helper success/failure into concise UI strings.

  Add `Guide.qml` with `QtQuick`, `QtQuick.Controls`, `QtQuick.Layouts`, `Quickshell`, `Quickshell.Io`, `Model.js`, and `GuideModel.js`. Use a `FloatingWindow` at roughly 900 by 760 with a scrollable column. Render: title/purpose; the generated `assets/numpad-workspace-concepts.png` with an accessible description; four prose cards based on `Model.guideSections()`; a collapsed-by-default full-list disclosure; and a bottom action row for Add to launcher and Close.

  Use a confirmation dialog before setting the launcher `Process` command to the fixed `bin/manage-launcher-entry`, `install`. Disable its action while the process runs and display `GuideModel.launcherState` after exit. Escape, Close, and `onVisibleChanged` must call `shell.hide(manifest.id)` when available. No process is started from `Component.onCompleted`.

  Select the user-approved image-generation result, copy it into `assets/numpad-workspace-concepts.png`, and inspect it at its final rendered size. Keep guide text as the exact accessible explanation of focus outline, filled window, blank workspace, arrows, and protection marker; do not depend on embedded image text.

- [ ] **Step 4: Run tests and QML validation**

  Run: `node tests/guide-model.test.cjs && qmllint Guide.qml`

  Expected: the Node suite prints its pass message and QML lint emits no errors.

- [ ] **Step 5: Commit the panel**

  ```bash
  git add Guide.qml GuideModel.js assets/numpad-workspace-concepts.png tests/guide-model.test.cjs
  git commit -m "feat: add numpad shortcuts guide panel"
  ```

### Task 4: Manifest, documentation, validation, and local install

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: `tests/model.test.cjs`
- Modify: `.gitignore`

**Interfaces:**
- Manifest declares `kinds: ["service", "panel"]` and `entryPoints.service` plus `entryPoints.panel: "Guide.qml"`.
- README documents `Super + Ctrl + keypad Divide`, guide content, optional launcher entry, and removal of the marked desktop file.

- [ ] **Step 1: Write failing release-contract assertions**

  Add to `tests/model.test.cjs`:

  ```js
  assert.equal(manifest.version, "0.3.0");
  assert.deepEqual(manifest.kinds, ["service", "panel"]);
  assert.equal(manifest.entryPoints.panel, "Guide.qml");
  assert.ok(readme.includes("Super + Ctrl + keypad Divide"));
  assert.match(readme, /Add to launcher/i);
  ```

- [ ] **Step 2: Run the contract test to verify it fails**

  Run: `node tests/model.test.cjs`

  Expected: failure because the manifest is still 0.2.0 and declares only service.

- [ ] **Step 3: Wire manifest and documentation**

  Bump the version to `0.3.0`, add the panel kind/entry point, and update the description. Update README with a concise Guide section that leads with the guide shortcut and concept-first content, explains that Add to launcher is optional and explicit, and documents the marked desktop file removal path. Add `.superpowers/` to `.gitignore` so visual-companion scratch files are never committed.

- [ ] **Step 4: Run complete automated validation**

  Run:

  ```bash
  lua tests/window-actions.test.lua \
    && node tests/model.test.cjs \
    && node tests/guide-model.test.cjs \
    && bash tests/launcher-entry.test.sh \
    && bash -n bin/open-guide bin/manage-launcher-entry \
    && qmllint Guide.qml Service.qml \
    && omarchy plugin validate . \
    && git diff --check
  ```

  Expected: every command exits 0.

- [ ] **Step 5: Install and live-verify locally**

  Copy the validated plugin files into `~/.config/omarchy/plugins/cylon58.numpad-shortcuts/`, rescan or restart Omarchy Shell, and inspect live Hyprland bindings for `Open Numpad Shortcuts guide`. Verify the guide opens by shortcut, Escape closes it, the four prose cards and illustration are legible, the full list is initially hidden then opens, and Add to launcher asks before it creates the marked desktop entry. Verify launcher search/opening and no Hyprland config errors.

- [ ] **Step 6: Commit release-facing files**

  ```bash
  git add manifest.json README.md tests/model.test.cjs .gitignore
  git commit -m "docs: publish numpad guide usage"
  ```

- [ ] **Step 7: Pause for user review before publication**

  Report the live verification outcome and wait for explicit user authorization before pushing the new commits or editing the existing marketplace verification request.
