const assert = require("node:assert/strict");
const Model = require("../Model.js");

const bindings = Model.bindings();

assert.equal(bindings.length, 21, "all numeric and navigation keypad keysyms plus keypad Enter are bound");
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "workspace" && binding.argument === "1").map((binding) => binding.key),
  ["KP_1", "KP_End"],
  "keypad 1 works with Num Lock on and off"
);
assert.deepEqual(
  bindings.filter((binding) => binding.dispatcher === "workspace" && binding.argument === "10").map((binding) => binding.key),
  ["KP_0", "KP_Insert"],
  "keypad 0 selects workspace 10 in both keypad modes"
);
assert.deepEqual(bindings.at(-1), {
  key: "KP_Enter",
  description: "Open terminal",
  dispatcher: "exec",
  argument: "/usr/share/omarchy/bin/omarchy-launch-terminal"
});

const script = Model.applyScript();
assert.match(script, /^hl\.config\(\{ \["input\.numlock_by_default"\] = true \}\)/, "the service enables Num Lock by default");
assert.match(script, /hl\.unbind\("SUPER \+ KP_1"\)\nhl\.bind\("SUPER \+ KP_1", hl\.dsp\.focus\(\{ workspace = "1" \}\), \{ description = "Switch to workspace 1" \}\)/);
assert.match(script, /hl\.bind\("SUPER \+ KP_Enter", hl\.dsp\.exec_cmd\("\/usr\/share\/omarchy\/bin\/omarchy-launch-terminal"\), \{ description = "Open terminal" \}\)$/);
assert.equal(Model.cleanupScript().split("\n").length, 21, "cleanup covers every dynamically added shortcut");

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

console.log("Model shortcut mapping tests passed");
