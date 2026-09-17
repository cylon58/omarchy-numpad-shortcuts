const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

// Hand-derived desktop-file encodings: string escapes, Exec quoting, and %%.
// https://specifications.freedesktop.org/desktop-entry-spec/latest/exec-variables.html
for (const [name, encodedName] of [
  ["ordinary", "ordinary"],
  ["space here", "space here"],
  ['double"quote', String.raw`double\\"quote`],
  ["single'quote", "single'quote"],
  ["back\\slash", String.raw`back\\\\slash`],
  ["percent%f%", "percent%%f%%"],
  ["dollar$and`backtick", 'dollar\\\\$and\\\\`backtick'],
  ["semi;pipe|amp&", "semi;pipe|amp&"],
  ["tab\there", String.raw`tab\there`],
  ["line\nbreak", String.raw`line\nbreak`]
]) {
  test(`desktop Exec launches the literal helper without arguments: ${JSON.stringify(name)}`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "numpad-desktop-"));
    try {
      const bin = path.join(tmp, name, "bin");
      fs.mkdirSync(bin, { recursive: true });
      const manager = path.join(bin, "manage-launcher-entry");
      fs.copyFileSync(path.resolve(__dirname, "../bin/manage-launcher-entry"), manager);
      const executable = path.join(bin, "open-guide");
      fs.writeFileSync(executable, '#!/bin/sh\nprintf \'%s\\0\' "$0" "$#"\n', { mode: 0o755 });
      const env = { ...process.env, XDG_DATA_HOME: path.join(tmp, "data") };
      const installed = spawnSync(manager, ["install"], { env, encoding: "utf8", timeout: 5000 });
      assert.equal(installed.status, 0, installed.stderr);
      const entry = path.join(env.XDG_DATA_HOME, "applications/cylon58-numpad-shortcuts-guide.desktop");
      const content = fs.readFileSync(entry, "utf8");
      // GIO reads the actual desktop file and expands field codes; no eval or
      // hand-written shell parser is involved in launcher verification.
      const launched = spawnSync("gjs", ["-c", `
        const { Gio, GLib } = imports.gi;
        const loop = new GLib.MainLoop(null, false);
        let status = 1;
        const file = new GLib.KeyFile();
        file.load_from_file(ARGV[0], GLib.KeyFileFlags.NONE);
        const app = Gio.AppInfo.create_from_commandline(
          file.get_string("Desktop Entry", "Exec"), "Test guide", Gio.AppInfoCreateFlags.NONE);
        app.launch_uris_as_manager([], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null, (_app, pid) => {
          GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (_pid, childStatus) => {
            status = childStatus; loop.quit();
          });
        });
        loop.run();
        imports.system.exit(status === 0 ? 0 : 1);
      `, entry], { env, encoding: "utf8", timeout: 5000 });
      assert.equal(launched.status, 0, launched.stderr);
      assert.deepEqual(launched.stdout.split("\0"), [executable, "0", ""]);
      assert.equal(content.split("\n").find(line => line.startsWith("Exec=")),
        `Exec="${tmp}/${encodedName}/bin/open-guide"`);
      const validated = spawnSync("desktop-file-validate", [entry], { encoding: "utf8", timeout: 5000 });
      assert.equal(validated.status, 0, validated.stdout + validated.stderr);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
