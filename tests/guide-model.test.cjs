const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Model = require("../Model.js");

const root = path.join(__dirname, "..");
assert.ok(fs.existsSync(path.join(root, "GuideModel.js")), "the guide presentation model exists");
assert.ok(fs.existsSync(path.join(root, "Guide.qml")), "the native guide panel exists");
const GuideModel = require("../GuideModel.js");

// Dropping a binding or maintaining a separate inventory loses canonical actions.
const bindings = Model.bindings();
const before = JSON.stringify(bindings);
const rows = GuideModel.fullShortcutRows(bindings);
assert.equal(rows.length, 25, "Num Lock variants share one row per action");
assert.deepEqual(rows.map(row => row.action), [...new Set(bindings.map(binding => binding.description))]);
assert.deepEqual(rows.find(row => row.action === "Move window to workspace 4"), {
  shortcut: "Super + Shift + KP_4 / KP_Left",
  action: "Move window to workspace 4"
});
assert.deepEqual(rows.find(row => row.action === "Open Numpad Shortcuts guide"), {
  shortcut: "Super + Ctrl + Numpad Divide",
  action: "Open Numpad Shortcuts guide"
});
assert.equal(JSON.stringify(bindings), before, "formatting does not mutate the canonical inventory");
assert.deepEqual(GuideModel.fullShortcutRows([]), []);
assert.deepEqual(GuideModel.fullShortcutRows([
  { modifiers: "SUPER", key: "KP_1", description: "A new action" },
  { modifiers: "SUPER", key: "KP_End", description: "A new action" },
  { modifiers: "CTRL", key: "KP_Enter", description: "A new action" }
]), [{ shortcut: "Super + KP_1 / KP_End; Ctrl + Numpad Enter", action: "A new action" }],
"new actions and distinct modifier combinations remain represented");

// Nonzero exits and invalid operations must never be reported as success.
for (const operation of ["install", "remove"]) {
  assert.equal(GuideModel.launcherState(0, operation).severity, "success");
  for (const exitCode of [1, 2, -1]) {
    const state = GuideModel.launcherState(exitCode, operation);
    assert.equal(state.severity, "error");
    assert.ok(state.message.length > 0);
  }
}
assert.equal(GuideModel.launcherState(0, "unexpected").severity, "error");
assert.match(GuideModel.launcherState(0, "install").message, /launcher/i);
assert.match(GuideModel.launcherState(1, "install").message, /custom.*(never|not).*overwrit/i);

// Lightweight panel contract checks supplement the pure model suite; live QML
// validation remains necessary for rendering, input, and dialog interaction.
const qml = fs.readFileSync(path.join(root, "Guide.qml"), "utf8");
assert.match(qml, /FloatingWindow\s*\{/);
assert.match(qml, /visible:\s*root\.opened/);
assert.match(qml, /property bool opened:\s*false/);
assert.match(qml, /Shortcut\s*\{[^}]*sequence:\s*"Escape"[^}]*onActivated:\s*root\.requestClose\(\)/s);
assert.match(qml, /shell\.hide\(manifest\.id\)/);
assert.match(qml, /onVisibleChanged:/);
assert.match(qml, /property bool fullListExpanded:\s*false/);
assert.match(qml, /Show full shortcut list/);
assert.match(qml, /GuideModel\.fullShortcutRows\(Model\.bindings\(\)\)/);
assert.match(qml, /Model\.guideSections\(\)/);
assert.match(qml, /Add to launcher/);
assert.match(qml, /onClicked:\s*launcherConfirmation\.open\(\)/);
assert.match(qml, /onAccepted:\s*root\.installLauncher\(\)/);
assert.match(qml, /enabled:\s*!launcherProcess\.running/);
assert.match(qml, /command\s*=\s*\[root\.launcherHelperPath,\s*"install"\]/);
assert.match(qml, /GuideModel\.launcherState\(exitCode,\s*"install"\)/);
assert.doesNotMatch(qml, /Component\.onCompleted/);
assert.doesNotMatch(qml, /\/home\/[^/]+/);

console.log("Guide model and panel contract tests passed");

// The rendered diagrams must tell the same story as the actual actions.
const focus = GuideModel.lesson(0, false);
assert.deepEqual(focus.before.map(s => [s.number, s.app]), focus.after.map(s => [s.number, s.app]));
assert.equal(focus.before.find(s => s.focused).number, 2);
assert.equal(focus.after.find(s => s.focused).number, 4);
const move = GuideModel.lesson(1, false);
assert.equal(move.before.find(s => s.focused).app, "Notes");
assert.equal(move.after.find(s => s.focused).app, "Notes");
assert.equal(move.after.find(s => s.focused).number, 4);
assert.equal(move.after.find(s => s.number === 2).app, "");

// Execute the real consolidation module against each illustrated desktop;
// compare its resulting app locations to the guide's claimed AFTER picture.
const { spawnSync } = require("node:child_process");
for (const protectedExample of [false, true]) {
  const example = GuideModel.lesson(3, false, protectedExample);
  const windows = example.before.filter(s => s.app).map(s =>
    `{ address = "${s.app}", workspace = { id = ${s.number} } }`).join(",");
  const script = `
    local windows = {${windows}}
    hl = {
      get_windows = function() return windows end,
      dispatch = function(move) move.window.workspace.id = move.workspace end,
      dsp = { window = { move = function(options) return options end } },
      notification = { create = function() end }
    }
    dofile("WindowActions.lua")
    ${protectedExample ? 'NumpadShortcuts.protected.Photos = true' : ''}
    NumpadShortcuts.consolidateGlobal()
    for _, w in ipairs(windows) do io.write(w.address, "=", w.workspace.id, "\\n") end
  `;
  const actual = spawnSync("lua", ["-e", script], { cwd: root, encoding: "utf8", timeout: 5000 });
  assert.equal(actual.status, 0, actual.stderr);
  assert.deepEqual(actual.stdout.trim().split("\n").sort(),
    example.after.filter(s => s.app).map(s => `${s.app}=${s.number}`).sort(),
    "consolidation picture matches real Lua movement, including protected gaps");
}
console.log("Guide examples agree with the real consolidation module");
