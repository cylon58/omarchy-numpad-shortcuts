const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const Model = require("../Model.js");

const root = path.resolve(__dirname, "..");
const service = fs.readFileSync(path.join(root, "Service.qml"), "utf8");
const expression = service.match(/property string guideLauncherPath: ([\s\S]*?)\n  readonly property/)[1];
const guidePath = vm.runInNewContext(expression, { Quickshell: { env: () => "/tmp/test-home" } });
assert.equal(guidePath, "/tmp/test-home/.config/omarchy/plugins/cylon58.numpad-shortcuts/bin/toggle-guide",
  "the service supplies the fixed keyboard toggle helper");

const lua = spawnSync("lua", ["-e", `
local captured
hl = {
  config = function() end, unbind = function() end,
  bind = function(keys, action) if keys == "SUPER + CTRL + KP_Divide" then captured = action end end,
  dsp = { focus = function() end, window = { move = function() end }, exec_cmd = function(command) return command end }
}
dofile = function() NumpadShortcuts = {} end
${Model.applyScript("/tmp/WindowActions.lua", guidePath)}
io.write(captured)
`], { timeout: 5000, encoding: "utf8" });
assert.equal(lua.status, 0, lua.stderr);
assert.equal(lua.stdout, guidePath, "Model generates the fixed toggle action for ordinary paths");

// Intercept only the external IPC exec; run the real argument validation and defaults.
for (const [helper, action] of [["toggle-guide", "toggle"], ["open-guide", "summon"]]) {
  const run = (args) => spawnSync("bash", ["-c", `
    exec() { printf '%s\\0' "$OMARCHY_PATH" "$@"; }
    helper=$1; shift
    . "$helper"
  `, "test-helper", path.join(root, "bin", helper), ...args], {
    timeout: 5000, encoding: "utf8", env: { PATH: "/usr/bin:/bin" }
  });
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.split("\0"), ["/usr/share/omarchy", "/usr/bin/omarchy-shell", "shell", action, "cylon58.numpad-shortcuts", ""]);
  const rejected = run(["arbitrary-command"]);
  assert.equal(rejected.status, 2, `${helper} rejects caller arguments`);
  assert.equal(rejected.stdout, "", "invalid arguments never reach shell IPC");
}
console.log("Guide keyboard toggle and launcher summon tests passed");
