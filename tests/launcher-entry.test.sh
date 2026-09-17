#!/usr/bin/env bash
set -euo pipefail

plugin_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
helper="$plugin_dir/bin/manage-launcher-entry"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export HOME="$tmp/home"
export XDG_DATA_HOME="$tmp/data"
entry="$XDG_DATA_HOME/applications/cylon58-numpad-shortcuts-guide.desktop"
expected="$tmp/expected-entry"

mkdir -p "$(dirname -- "$entry")"
printf '%s\n' \
  '[Desktop Entry]' \
  'Type=Application' \
  'Name=Numpad Shortcuts' \
  'Comment=Learn Numpad Shortcuts for Omarchy workspaces' \
  "Exec=$plugin_dir/bin/open-guide" \
  'Terminal=false' \
  'NoDisplay=false' \
  'X-Omarchy-Numpad-Shortcuts-Guide=true' >"$expected"

"$helper" install
cmp "$expected" "$entry"
grep -qx 'X-Omarchy-Numpad-Shortcuts-Guide=true' "$entry"

cp "$entry" "$tmp/owned-before"
"$helper" install
cmp "$tmp/owned-before" "$entry"

printf '[Desktop Entry]\nName=Custom\n' >"$entry"
cp "$entry" "$tmp/unowned-before"
if "$helper" install; then
  echo 'install unexpectedly replaced an unowned launcher entry' >&2
  exit 1
fi
cmp "$tmp/unowned-before" "$entry"
grep -qx 'Name=Custom' "$entry"
if "$helper" remove; then
  echo 'remove unexpectedly deleted an unowned launcher entry' >&2
  exit 1
fi
cmp "$tmp/unowned-before" "$entry"

rm "$entry"
"$helper" install
"$helper" remove
test ! -e "$entry"
if "$helper" remove; then
  echo 'remove unexpectedly succeeded for an absent launcher entry' >&2
  exit 1
fi
test ! -e "$entry"

echo 'launcher entry tests passed'
