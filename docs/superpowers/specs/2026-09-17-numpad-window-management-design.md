# Numpad Window Management Design

## Goal

Extend the Numpad Shortcuts Omarchy plugin with keypad window movement,
temporary protection from consolidation, and two safe workspace-consolidation
commands. Keep the plugin lightweight and do not add a window overlay.

## Scope

The plugin continues to manage numeric workspaces 1 through 10 only. Named,
special, and numeric workspaces above 10 are not changed by consolidation.

Existing behavior remains unchanged:

- `Super + KP 1` through `KP 0` switches to workspaces 1 through 10.
- The navigation-keypad equivalents work when Num Lock is off.
- `Super + KP Enter` launches the terminal.

New behavior:

- `Super + Shift + KP 1` through `KP 0` moves the focused window to
  workspaces 1 through 10. The Num Lock-off equivalents are included.
- `Super + Ctrl + KP Enter` toggles protection for the focused window.
- `Super + Ctrl + Shift + KP Enter` consolidates all eligible numeric
  workspaces across monitors.
- `Super + Ctrl + Shift + Alt + KP Enter` consolidates only the focused
  monitor.

## Architecture

The existing Quickshell service remains the single process. It invokes only
the fixed `/usr/bin/hyprctl` binary, with the existing restricted environment,
to evaluate a generated Hyprland Lua script against the discovered compositor
instance.

The generated Lua script creates or reuses one plugin-owned global state table
inside the current Hyprland Lua context. Its `protected` map is keyed by a
live window address. This state is intentionally session-only: it survives a
normal binding reapply in the same compositor, but does not attempt to identify
an application after it or Hyprland restarts.

The Lua functions use Hyprland's native live-window and workspace APIs. They
invoke movement through `hl.dispatch(hl.dsp.window.move(...))`; no helper
daemon, IPC parser, window overlay, persistent database, or shell command per
window is introduced.

## Protection Behavior

The protection shortcut uses the focused live window. It adds or removes the
window's address from the state map and issues a short Hyprland notification
confirming the action. If there is no focused window, it issues a concise
notification and makes no change.

Protection means only that this plugin's consolidation functions will not move
the window. It does not use Hyprland's native `pin` dispatcher, which makes a
floating window visible on every workspace and has different semantics.

Before every consolidation, the plugin removes protection entries whose live
window addresses no longer exist. A protected window is never dispatched to a
different workspace. If a workspace contains protected and unprotected
windows, only its unprotected windows may move.

## Global Consolidation

Global consolidation considers all ordinary numeric workspaces with IDs 1 to
10, regardless of monitor. It processes source workspaces in ascending numeric
order and preserves the unprotected windows from a source workspace as a group.

Each unprotected group moves silently to the earliest lower eligible
workspace. An eligible destination has no protected window and has not already
been retained or filled by an earlier source group. A workspace containing a
protected window is reserved at its current ID. When a source has both
protected and unprotected windows, the unprotected group can move into an
earlier eligible gap while the protected window remains behind. This
intentionally leaves a gap when protection requires one.

Every automatic move sets `follow = false`; consolidation does not change the
user's focused workspace. Since a numeric workspace belongs to one monitor,
global consolidation can move a group to that workspace's monitor. Special,
named, and out-of-range workspaces are not examined or moved. A no-op reports
that the eligible workspaces are already compact; a successful operation
reports the number of moved windows.

## Focused-Monitor Consolidation

Focused-monitor consolidation affects only windows whose workspace belongs to
the currently focused monitor. It uses the same grouping and protection rules
as global consolidation.

Destination IDs must be free on the current monitor and must not be owned by
another monitor. If a lower numeric ID is occupied elsewhere, it is skipped;
the function leaves a gap rather than transferring a window between displays.
Moves are silent and keep focus unchanged.

## Binding Lifecycle

`Model.js` remains the source of the binding inventory and generated Lua
script. It will include every dynamic binding in both apply and cleanup output:
20 switch bindings, 20 move bindings, terminal launch, protection toggle,
global consolidation, and focused-monitor consolidation.

The service's regular binding probe will use an upgraded binding sentinel, so
a live compositor that still has only the old terminal and switch bindings is
reconfigured. Existing instance discovery, timeout, serialized apply behavior,
and reload recovery remain in place.

## Validation

Automated tests will exercise the generated Lua behavior under a small fake
Hyprland harness, asserting observable dispatcher calls and notifications.
They cover:

- switch and move mappings for Num Lock-on and Num Lock-off keysyms;
- terminal, protection, and both consolidation shortcuts;
- protection toggle, missing-focus handling, and stale-address pruning;
- global packing, protected gaps, and mixed protected/unprotected sources;
- focused-monitor packing and exclusion of IDs owned by another monitor;
- silent moves and upgraded binding-probe detection.

The plugin documentation will describe all shortcuts, session-only protection,
the global versus focused-monitor distinction, and the intentional lack of a
per-window overlay. The manifest version will change from `0.1.1` to `0.2.0`.

Before user testing, run the focused automated tests and `omarchy plugin
validate`. Install the validated local build to the active user plugin
directory and verify the key flows manually. Do not push the GitHub update or
submit any marketplace change until the user approves publication after local
testing.
