# Numpad Shortcuts

An Omarchy service plugin that adds the number-pad equivalents of Omarchy’s
workspace and terminal shortcuts.

- `Super` + keypad `1`–`9` switches to workspaces 1–9.
- `Super` + keypad `0` switches to workspace 10.
- `Super` + keypad `Enter` opens the terminal.

The workspace shortcuts work with Num Lock either on or off. The plugin also
sets Hyprland’s `input:numlock_by_default` option to `true` for the current
session, so newly initialized keypads start in numeric mode. The shortcuts are
restored automatically after Hyprland reloads its configuration.

## Requirements

- Omarchy with Quickshell and Hyprland

## Install

```bash
omarchy plugin add https://github.com/cylon58/omarchy-numpad-shortcuts.git --enable
```

## Update

```bash
omarchy plugin update cylon58.numpad-shortcuts
```

## Remove

```bash
omarchy plugin remove cylon58.numpad-shortcuts
hyprctl reload
```

Run `hyprctl reload` after removal to clear the session-only dynamic bindings.

## Security boundaries

The service runs only the fixed `/usr/bin/hyprctl` executable with a minimal
environment. It has no network access, shell execution, elevated privileges,
or retained command output. It polls the active Hyprland instance and binding
table, restoring the shortcuts when a reload clears them. Binding updates are
stopped after 10 seconds if `hyprctl` does not complete.

## License

MIT. See [LICENSE](LICENSE).
