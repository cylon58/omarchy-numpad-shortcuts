function fullShortcutRows(bindings) {
  var groups = [];
  for (var i = 0; i < bindings.length; i++) {
    var binding = bindings[i];
    var group = groups.filter(function(item) { return item.action === binding.description; })[0];
    if (!group) {
      group = { action: binding.description, combinations: [] };
      groups.push(group);
    }
    var combination = group.combinations.filter(function(item) { return item.modifiers === binding.modifiers; })[0];
    if (!combination) {
      combination = { modifiers: binding.modifiers, keys: [] };
      group.combinations.push(combination);
    }
    if (combination.keys.indexOf(binding.key) === -1) combination.keys.push(binding.key);
  }

  return groups.map(function(group) {
    return {
      action: group.action,
      shortcut: group.combinations.map(function(combination) {
        var modifiers = combination.modifiers.split(/\s*\+\s*/).map(function(modifier) {
          return modifier.charAt(0).toUpperCase() + modifier.slice(1).toLowerCase();
        }).join(" + ");
        var keys = combination.keys.map(function(key) {
          if (key === "KP_Divide") return "Numpad Divide";
          if (key === "KP_Enter") return "Numpad Enter";
          return key;
        }).join(" / ");
        return (modifiers ? modifiers + " + " : "") + keys;
      }).join("; ")
    };
  });
}

function launcherState(exitCode, operation) {
  if (operation !== "install" && operation !== "remove") {
    return { message: "Unknown launcher operation.", severity: "error" };
  }
  if (exitCode === 0) {
    return {
      message: operation === "install" ? "Numpad Shortcuts is available in your launcher." : "Numpad Shortcuts was removed from your launcher.",
      severity: "success"
    };
  }
  return {
    message: operation === "install"
      ? "Could not add the launcher entry. Existing custom launchers are never overwritten. You can still open this guide with Super + Ctrl + Numpad Divide."
      : "Could not remove the launcher entry. Only this plugin's marked entry can be removed.",
    severity: "error"
  };
}

// Teaching examples, not a view of the user's live desktop.
function lesson(index, localOnly, protectLast) {
  function space(number, app, focused, protectedWindow) {
    return { number: number, app: app || "", focused: !!focused, protectedWindow: !!protectedWindow };
  }
  var examples = [
    {
      action: "Super + Numpad 4",
      before: [space(2, "Browser", true), space(4, "Notes")],
      after: [space(2, "Browser"), space(4, "Notes", true)],
      result: "You are now on workspace 4. Both windows stayed where they were.",
      note: "A workspace is a numbered desktop, not a physical monitor. You can switch to an empty workspace too."
    },
    {
      action: "Super + Shift + Numpad 4",
      before: [space(2, "Notes", true), space(4)],
      after: [space(2), space(4, "Notes", true)],
      result: "Notes moves from 2 to 4, and you follow it. Workspace 2 is now empty.",
      note: "Only the focused window moves. The destination can already contain other windows."
    },
    {
      action: "Super + Ctrl + Numpad Enter",
      before: [space(4, "Photos", true)],
      after: [space(4, "Photos", true, true)],
      result: "Photos stays on workspace 4 when you consolidate. Press again to unprotect it.",
      note: "Protection is for consolidation only: you can still move this window yourself. A notification confirms the change; the lock here is an illustration, not a title-bar button. Protection resets when the window closes, Hyprland restarts, or its configuration reloads."
    },
    {
      action: "Super + Ctrl + Shift + " + (localOnly ? "Alt + " : "") + "Numpad Enter",
      before: [space(1, "Browser"), space(2), space(3, "Notes"), space(4, "Photos")],
      after: [space(1, "Browser"), space(2, "Notes"), space(3, "Photos"), space(4)],
      result: "Notes: 3 → 2. Photos: 4 → 3. The gap is gone; the groups keep their order.",
      note: localOnly
        ? "Only windows on the focused monitor move. Workspaces owned by another monitor are left alone. Protected windows stay put, so some gaps can remain."
        : "Works on workspaces 1–10 across all monitors; windows may change monitors. Windows from the same workspace move together, except protected windows, which stay put. Some gaps can remain."
    }
  ];
  if (protectLast) {
    examples[3].before[3].protectedWindow = true;
    examples[3].after = [space(1, "Browser"), space(2, "Notes"), space(3), space(4, "Photos", false, true)];
    examples[3].result = "Notes: 3 → 2. Protected Photos stays on 4, leaving workspace 3 empty.";
  }
  return examples[Math.max(0, Math.min(3, index))];
}

if (typeof module !== "undefined") module.exports = {
  fullShortcutRows: fullShortcutRows,
  launcherState: launcherState,
  lesson: lesson
};
