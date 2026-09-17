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

if (typeof module !== "undefined") module.exports = {
  fullShortcutRows: fullShortcutRows,
  launcherState: launcherState
};
