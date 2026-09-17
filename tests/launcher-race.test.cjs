const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const helper = path.resolve(__dirname, "../bin/manage-launcher-entry");
for (const kind of ["file", "symlink", "directory-symlink"]) {
  test(`publication preserves a competing ${kind} created after the absence check`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "numpad-race-"));
    try {
      const data = path.join(tmp, "data");
      const entry = path.join(data, "applications/cylon58-numpad-shortcuts-guide.desktop");
      const destination = path.join(tmp, "destination");
      if (kind === "directory-symlink") fs.mkdirSync(destination);
      // Override chmod only in this shell: create the competing destination after
      // the final chmod but immediately before publication. No production hook.
      const run = spawnSync("bash", ["-c", `
        chmod() {
          /usr/bin/chmod "$@" || return
          if [ "$1" = 644 ]; then
            case "$RACE_KIND" in
              file) printf '[Desktop Entry]\\nName=Created concurrently\\n' > "$RACE_ENTRY" ;;
              *) /usr/bin/ln -s "$RACE_DESTINATION" "$RACE_ENTRY" ;;
            esac
          fi
        }
        . "$0"
      `, helper, "install"], {
        encoding: "utf8", timeout: 5000,
        env: { ...process.env, XDG_DATA_HOME: data, RACE_KIND: kind, RACE_ENTRY: entry, RACE_DESTINATION: destination }
      });
      assert.notEqual(run.status, 0, "install must fail if another entry wins publication");
      if (kind === "file") {
        assert.equal(fs.readFileSync(entry, "utf8"), "[Desktop Entry]\nName=Created concurrently\n");
      } else {
        assert.equal(fs.readlinkSync(entry), destination);
        if (kind === "directory-symlink") assert.deepEqual(fs.readdirSync(destination), []);
        else assert.equal(fs.existsSync(destination), false);
      }
      assert.deepEqual(fs.readdirSync(path.dirname(entry)), [path.basename(entry)], "temporary entries are cleaned up");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
