const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Model = require("../Model.js");

const pluginRoot = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8"));
const readme = fs.readFileSync(path.join(pluginRoot, "README.md"), "utf8");

// Release contract: a packaged guide must be discoverable to both Omarchy and users.
assert.equal(manifest.version, "0.3.0");
assert.deepEqual(manifest.kinds, ["service", "panel"]);
assert.equal(manifest.entryPoints.service, "Service.qml");
assert.equal(manifest.entryPoints.panel, "Guide.qml");
assert.ok(readme.includes("Super + Ctrl + keypad Divide"));
assert.match(readme, /Add to launcher/i);
assert.match(manifest.description, /guide/i, "the manifest advertises the guide alongside the window-management capabilities");
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
for (const title of ["Switch focus", "Move a window"]) {
  const details = Model.guideSections().find(section => section.title === title).details;
  assert.match(details, /occupied or empty/, `${title} accepts both target states`);
  assert.match(details, /illustration/, `${title} distinguishes the illustrated example from the general behavior`);
}

const script = Model.applyScript("/tmp/WindowActions.lua", "/tmp/open-guide");
assert.ok(script.startsWith('hl.config({ ["input.numlock_by_default"] = true })\ndofile('), "enable Num Lock and load the action module before registering callbacks");
for (const modulePath of ["/tmp/WindowActions.lua", "C:\\plugin's.lua", '/tmp/double"quote/line\nbreak\ttab.lua']) {
  const evaluated = spawnSync("lua", ["-e", `
    hl = { config = function() end, unbind = function() end, bind = function() end,
      dsp = { focus = function() end, window = { move = function() end }, exec_cmd = function() end } }
    dofile = function(path) io.write(path); NumpadShortcuts = {} end
    ${Model.applyScript(modulePath, "/tmp/open-guide")}
  `], { encoding: "utf8", timeout: 5000 });
  assert.equal(evaluated.status, 0, `generated Lua parses module paths: ${evaluated.stderr}`);
  assert.equal(evaluated.stdout, modulePath, "dofile receives the literal module path unchanged");
}
assert.match(script, /hl\.unbind\("SUPER \+ KP_1"\)\nhl\.bind\("SUPER \+ KP_1", hl\.dsp\.focus\(\{ workspace = "1" \}\), \{ description = "Switch to workspace 1" \}\)/);
assert.match(script, /hl\.bind\("SUPER \+ SHIFT \+ KP_1", hl\.dsp\.window\.move\(\{ workspace = "1" \}\), \{ description = "Move window to workspace 1" \}\)/, "ordinary movement retains Omarchy's normal default follow behavior");
assert.match(script, /hl\.bind\("SUPER \+ CTRL \+ KP_Divide", hl\.dsp\.exec_cmd\("\/tmp\/open-guide"\), \{ description = "Open Numpad Shortcuts guide" \}\)/, "the guide binding runs only the launcher path supplied by QML");
assert.equal(Model.cleanupScript().split("\n").length, 45, "cleanup covers every dynamically added shortcut");

const instanceJson = JSON.stringify([
  { instance: "active-signature", pid: 1234, wl_socket: "wayland-1" }
]);
assert.equal(Model.activeInstanceSignature(instanceJson), "active-signature", "the live Hyprland instance can be targeted after a reload");
assert.equal(Model.activeInstanceSignature("not json"), "", "invalid instance output is ignored");
const multipleInstances = JSON.stringify([{ instance: "other-session" }, { instance: "current-session" }]);
assert.equal(Model.activeInstanceSignature(multipleInstances, "current-session"), "current-session", "target the shell's own Hyprland instance, not the first listed instance");
assert.equal(Model.activeInstanceSignature(multipleInstances, "missing-session"), "", "a missing expected session must never select another session");
assert.equal(Model.activeInstanceSignature(multipleInstances, ""), "", "multiple sessions without a known signature are ambiguous");
assert.equal(Model.activeInstanceSignature(instanceJson, ""), "active-signature", "an unambiguous single session remains discoverable without an environment signature");
assert.deepEqual(
  Model.hyprctlEvalArguments("return true", "active-signature"),
  ["--instance", "active-signature", "eval", "return true"],
  "binding commands explicitly target the discovered Hyprland instance"
);
const modifierMasks = { SUPER: 64, CTRL: 4, SHIFT: 1, ALT: 8 };
const liveBindings = bindings.map(binding => ({
  key: binding.key,
  modmask: binding.modifiers.split(" + ").reduce((mask, modifier) => mask | modifierMasks[modifier], 0),
  submap: "",
  description: binding.description
}));
assert.equal(Model.bindingsAreActive(JSON.stringify(liveBindings)), true, "every expected live binding is present");
assert.equal(Model.bindingsAreActive(JSON.stringify(liveBindings.filter(binding => !["KP_9", "KP_Prior"].includes(binding.key)))), false, "missing workspace-9 bindings must trigger restoration");
assert.equal(Model.bindingsAreActive(JSON.stringify(liveBindings.filter(binding => !(binding.key === "KP_End" && binding.modmask === 64)))), false, "a missing Num Lock-off alias must trigger restoration");
for (const replacement of [{ modmask: 0 }, { submap: "other-mode" }, { description: "Unrelated action" }, { key: "KP_Decimal" }]) {
  const damaged = liveBindings.map((binding, index) => index === 0 ? { ...binding, ...replacement } : binding);
  assert.equal(Model.bindingsAreActive(JSON.stringify(damaged)), false, `a wrong binding field must trigger restoration: ${JSON.stringify(replacement)}`);
}
assert.equal(Model.bindingsAreActive(JSON.stringify([...liveBindings, { key: "A", modmask: 64, submap: "", description: "Other shortcut" }])), true, "unrelated desktop bindings do not affect the plugin health check");
assert.equal(Model.bindingsAreActive(JSON.stringify([
  { key: "KP_Enter", description: "Open terminal" },
  { key: "KP_1", description: "Move window to workspace 1" },
  { key: "KP_Enter", description: "Toggle window consolidation protection" },
  { key: "KP_Enter", description: "Consolidate workspaces on all monitors" }
])), false, "a missing window-management sentinel triggers restoration");
assert.equal(Model.bindingsAreActive("[]"), false, "a cleared Hyprland binding table triggers restoration");

console.log("Model shortcut mapping tests passed");
