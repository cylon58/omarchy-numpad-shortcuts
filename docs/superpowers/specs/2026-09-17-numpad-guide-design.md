# Numpad Shortcuts Guide Design

## Goal

Make the plugin discoverable without turning its core behavior into a
keybinding reference dump. Add a native Omarchy guide window that teaches the
four key ideas—switch focus, move a window, protect a window, and consolidate
gaps—with clear prose and a polished drawn workspace illustration. Keep the
complete binding inventory available on demand.

## Scope

The existing plugin becomes both a `service` and a `panel` plugin. It remains
one lightweight Quickshell-hosted package; no standalone app, daemon, web
server, persistent protection store, or window overlay is added.

New entry points:

- `Super + Ctrl + KP Divide` toggles the guide panel. This is separate from
  all window-management shortcuts and works in both Num Lock states where
  Hyprland exposes the relevant keypad keysym.
- An optional launcher entry named **Numpad Shortcuts** opens the same guide.
  It is created only after explicit user confirmation from the guide.

Existing movement, protection, and consolidation behavior is unchanged.

## Native Panel

The manifest declares `service` and `panel` kinds and adds a `panel` entry
point. The panel is a normal summoned Omarchy `FloatingWindow`, not a
fullscreen overlay. It is kept loaded so opening and closing it does not
recreate unrelated binding state.

The existing service remains responsible for Hyprland binding generation. Its
new guide binding invokes Omarchy Shell's supported `toggle` IPC method for
this plugin id. Shell IPC owns panel loading and visibility; the Lua callback
does not construct a UI or maintain a second process.

The panel closes with Escape, its Close button, or its normal window close
control. It never moves windows, changes protection, or consolidates workspaces
when opened.

## Guide Content

The guide's main content is intentionally ordered by concepts, not by every
keysym:

1. **Switch focus** — `Super + keypad number`; the focus outline travels to a
   different occupied workspace while windows remain in their workspaces.
2. **Move a window** — `Super + Shift + keypad number`; a window visibly
   travels from the focused source workspace to a blank target workspace.
3. **Protect a window** — `Super + Ctrl + keypad Enter`; the focused window
   receives a protection marker and stays put during consolidation for the
   current session.
4. **Consolidate gaps** — `Super + Ctrl + Shift + keypad Enter`; an
   unprotected workspace group shifts left into a blank numeric workspace,
   while a protected workspace remains fixed. The card also states that adding
   Alt limits consolidation to the focused monitor.

Each concept has concise selectable text and its shortcut first. A bundled
drawn four-panel illustration sits with the content and reinforces the same
states:

- a bright outline represents focused workspace;
- a filled window glyph represents an occupied workspace;
- a dashed workspace represents a blank workspace;
- arrows distinguish focus movement from window movement;
- a distinct protection marker represents a window that consolidation cannot
  move.

The illustration is decorative support, not the only carrier of meaning. Text
and accessible descriptions state each state transition. The final raster asset
is versioned in the plugin and has no embedded instructional prose, making the
QML text the source of exact shortcut wording.

An initially collapsed **Show full shortcut list** control reveals the complete
live inventory: workspace switching and moving bindings, Num Lock-off variants,
terminal, guide, protection, and both consolidation actions. The list is
derived from `Model.js` binding definitions rather than a second hand-maintained
table.

## Launcher Entry

Omarchy's current plugin manifest has no lifecycle hook or launcher-entry
metadata. The plugin must not silently write `~/.local/share/applications`.

The guide therefore includes **Add to launcher**. Pressing it displays a clear
confirmation that one user-owned desktop entry will be created. Confirming
creates `~/.local/share/applications/cylon58-numpad-shortcuts-guide.desktop`
only when no non-plugin-owned entry already exists. The entry's sole action is
to execute a plugin-owned fixed launcher helper, which summons this panel over
Omarchy Shell IPC. It takes no user-provided command, arguments, or path.

If an entry already exists but does not carry the plugin's ownership marker,
the guide leaves it untouched and explains that it will not overwrite a custom
launcher. Creation failures are shown in the guide; the keyboard shortcut
remains usable. Removal instructions remove only the marked file.

## Architecture and Files

- `manifest.json`: declare the panel entry point and bump the version.
- `Model.js`: add the guide binding and expose structured binding data for the
  panel's full-list view.
- `Service.qml`: continue applying the generated bindings; use the fixed
  guide-toggle command through the existing restricted Hyprland path.
- `Guide.qml`: panel state, polished guide layout, text, illustration, full-list
  disclosure, Escape/Close handling, launcher confirmation and status.
- `GuideModel.js`: pure formatting and launcher-entry content helpers.
- `assets/numpad-workspace-concepts.png`: selected generated four-panel
  illustration, bundled in the plugin.
- `bin/open-guide` and `bin/manage-launcher-entry`: fixed-argument helpers for
  launching the guide and atomically creating/removing only its marked desktop
  entry.
- `tests/guide-model.test.cjs`: presentation data and desktop-entry safety
  tests.

The launcher helpers receive no arbitrary external strings. They set only the
known Omarchy path needed by the existing shell wrapper and invoke the fixed
plugin id. The panel uses a process only for the explicit opt-in launcher
operation; it performs no persistent write at ordinary guide open.

## Validation

Automated checks cover:

- exact guide shortcut and Num Lock-off mapping behavior;
- full-list derivation from the canonical bindings inventory;
- generated desktop-entry content, ownership marker, refusal to overwrite an
  unowned entry, and removal limited to the marked entry;
- panel source sanity for Escape/Close handling, collapsed-by-default list, and
  no automatic launcher installation;
- existing movement/protection/consolidation tests;
- `omarchy plugin validate` and QML linting.

Live verification covers the guide shortcut, launcher opt-in confirmation,
launcher search and opening, Escape close, full-list disclosure, and existing
window-management bindings after a shell restart. Before public release, the
user reviews the guide visually and explicitly authorizes the GitHub and
marketplace update.
