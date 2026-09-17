const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Model = require("../Model.js");

const pluginRoot = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8"));
const readme = fs.readFileSync(path.join(pluginRoot, "README.md"), "utf8");

assert.equal(manifest.version, "0.2.0", "the release manifest identifies the window-management feature version");
assert.match(manifest.description, /switching, moving, and consolidation/, "the manifest advertises the new window-management capabilities");
for (const shortcut of [
  "Super + Shift + keypad 1–0",
  "Super + Ctrl + keypad Enter",
  "Super + Ctrl + Shift + keypad Enter",
  "Super + Ctrl + Shift + Alt + keypad Enter"
]) {
  assert.ok(readme.includes(shortcut), `README documents ${shortcut}`);
}
assert.match(readme, /session-only protection/i, "README explains that protection is session-only");

const bindings = Model.bindings();

assert.equal(bindings.length, 45, "all focus, movement, terminal, window-management, and guide keypad shortcuts are bound");
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "workspace" && binding.argument === "1").map((binding) => [binding.modifiers, binding.key]),
  [["SUPER", "KP_1"], ["SUPER", "KP_End"]],
  "keypad 1 works with Num Lock on and off"
);
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "workspace" && binding.argument === "10").map((binding) => [binding.modifiers, binding.key]),
  [["SUPER", "KP_0"], ["SUPER", "KP_Insert"]],
  "keypad 0 selects workspace 10 in both keypad modes"
);
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
assert.deepEqual(bindings.at(-1), {
  modifiers: "SUPER + CTRL",
  key: "KP_Divide",
  description: "Open Numpad Shortcuts guide",
  dispatcher: "guide",
  argument: ""
});
assert.deepEqual(Model.guideSections().map((section) => section.title), [
  "Switch focus", "Move a window", "Protect a window", "Consolidate gaps"
], "the guide presents the four workspace concepts in their intended order");

const script = Model.applyScript("/tmp/WindowActions.lua", "/tmp/open-guide");
assert.match(script, /^hl\.config\(\{ \["input\.numlock_by_default"\] = true \}\)\ndofile\('\/tmp\/WindowActions\.lua'\)/, "the service enables Num Lock by default and loads the action module before registering callbacks");
assert.ok(
  Model.applyScript("C:\\plugin's.lua", "C:\\open-guide").includes("dofile('C:\\\\plugin\\'s.lua')"),
  "the Lua module path escapes backslashes and single quotes"
);
assert.match(script, /hl\.unbind\("SUPER \+ KP_1"\)\nhl\.bind\("SUPER \+ KP_1", hl\.dsp\.focus\(\{ workspace = "1" \}\), \{ description = "Switch to workspace 1" \}\)/);
assert.match(script, /hl\.bind\("SUPER \+ SHIFT \+ KP_1", hl\.dsp\.window\.move\(\{ workspace = "1" \}\), \{ description = "Move window to workspace 1" \}\)/, "ordinary movement retains Omarchy's normal default follow behavior");
assert.match(script, /hl\.bind\("SUPER \+ CTRL \+ KP_Divide", hl\.dsp\.exec_cmd\("\/tmp\/open-guide"\), \{ description = "Open Numpad Shortcuts guide" \}\)/, "the guide binding runs only the launcher path supplied by QML");
assert.ok(
  Model.applyScript("/tmp/WindowActions.lua", "C:\\guide").includes('hl.dsp.exec_cmd("C:\\\\guide")'),
  "the guide launcher path escapes backslashes for the generated Lua command"
);
assert.equal(Model.cleanupScript().split("\n").length, 45, "cleanup covers every dynamically added shortcut");

const instanceJson = JSON.stringify([
  { instance: "active-signature", pid: 1234, wl_socket: "wayland-1" }
]);
assert.equal(Model.activeInstanceSignature(instanceJson), "active-signature", "the live Hyprland instance can be targeted after a reload");
assert.equal(Model.activeInstanceSignature("not json"), "", "invalid instance output is ignored");
assert.deepEqual(
  Model.hyprctlEvalArguments("return true", "active-signature"),
  ["--instance", "active-signature", "eval", "return true"],
  "binding commands explicitly target the discovered Hyprland instance"
);
assert.equal(Model.bindingsAreActive(JSON.stringify([
  { key: "KP_Enter", description: "Open terminal" },
  { key: "KP_1", description: "Move window to workspace 1" },
  { key: "KP_Enter", description: "Toggle window consolidation protection" },
  { key: "KP_Enter", description: "Consolidate workspaces on all monitors" },
  { key: "KP_Enter", description: "Consolidate workspaces on focused monitor" },
  { key: "KP_Divide", description: "Open Numpad Shortcuts guide" }
])), true, "the live binding probe requires every sentinel shortcut");
assert.equal(Model.bindingsAreActive(JSON.stringify([
  { key: "KP_Enter", description: "Open terminal" },
  { key: "KP_1", description: "Move window to workspace 1" },
  { key: "KP_Enter", description: "Toggle window consolidation protection" },
  { key: "KP_Enter", description: "Consolidate workspaces on all monitors" }
])), false, "a missing window-management sentinel triggers restoration");
assert.equal(Model.bindingsAreActive("[]"), false, "a cleared Hyprland binding table triggers restoration");

console.log("Model shortcut mapping tests passed");
