const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const Model = require("../Model.js");

for (const name of ["ordinary", "space here", 'double"quote', "single'quote", "back\\slash",
  "$(touch injected-dollar)", "`touch injected-backtick`", "semi;touch injected-semicolon;#",
  "pipe|amp&glob*question?less<greater>paren()", "line\nbreak", "tab\there"]) {
  test(`guide command executes only the literal helper path: ${JSON.stringify(name)}`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "numpad-command-"));
    try {
      const helper = path.join(tmp, name);
      fs.writeFileSync(helper, '#!/bin/sh\nprintf \'%s\\0\' "$0" "$#"\n', { mode: 0o755 });
      // Parse and evaluate all generated Lua against a narrow Hyprland boundary double.
      const lua = spawnSync("lua", ["-e", `
        local captured
        hl = {
          config = function() end, unbind = function() end,
          bind = function(keys, action) if keys == "SUPER + CTRL + KP_Divide" then captured = action end end,
          dsp = { focus = function() end, window = { move = function() end }, exec_cmd = function(command) return command end }
        }
        dofile = function() NumpadShortcuts = {} end
        ${Model.applyScript("/tmp/WindowActions.lua", helper)}
        io.write(captured)
      `], { encoding: "utf8", timeout: 5000 });
      assert.equal(lua.status, 0, `generated Lua must parse: ${lua.stderr}`);
      const executed = spawnSync("/bin/sh", ["-c", lua.stdout], { cwd: tmp, encoding: "utf8", timeout: 5000 });
      assert.deepEqual(fs.readdirSync(tmp), [name], "shell fragments in the path must not create injected files");
      assert.equal(executed.status, 0, executed.stderr);
      assert.deepEqual(executed.stdout.split("\0"), [helper, "0", ""], "execute exactly this helper with no arguments");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
