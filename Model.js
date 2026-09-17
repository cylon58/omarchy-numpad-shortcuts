function bindings() {
  var workspaceKeys = [
    ["KP_1", "KP_End", "1"],
    ["KP_2", "KP_Down", "2"],
    ["KP_3", "KP_Next", "3"],
    ["KP_4", "KP_Left", "4"],
    ["KP_5", "KP_Begin", "5"],
    ["KP_6", "KP_Right", "6"],
    ["KP_7", "KP_Home", "7"],
    ["KP_8", "KP_Up", "8"],
    ["KP_9", "KP_Prior", "9"],
    ["KP_0", "KP_Insert", "10"]
  ];
  var result = [];

  for (var i = 0; i < workspaceKeys.length; i++) {
    var keys = workspaceKeys[i];
    result.push({
      modifiers: "SUPER",
      key: keys[0],
      description: "Switch to workspace " + keys[2],
      dispatcher: "workspace",
      argument: keys[2]
    });
    result.push({
      modifiers: "SUPER",
      key: keys[1],
      description: "Switch to workspace " + keys[2],
      dispatcher: "workspace",
      argument: keys[2]
    });
    result.push({
      modifiers: "SUPER + SHIFT",
      key: keys[0],
      description: "Move window to workspace " + keys[2],
      dispatcher: "move",
      argument: keys[2]
    });
    result.push({
      modifiers: "SUPER + SHIFT",
      key: keys[1],
      description: "Move window to workspace " + keys[2],
      dispatcher: "move",
      argument: keys[2]
    });
  }

  result.push({
    modifiers: "SUPER",
    key: "KP_Enter",
    description: "Open terminal",
    dispatcher: "exec",
    argument: "/usr/share/omarchy/bin/omarchy-launch-terminal"
  });
  result.push({
    modifiers: "SUPER + CTRL",
    key: "KP_Enter",
    description: "Toggle window consolidation protection",
    dispatcher: "callback",
    argument: "NumpadShortcuts.toggleProtection"
  });
  result.push({
    modifiers: "SUPER + CTRL + SHIFT",
    key: "KP_Enter",
    description: "Consolidate workspaces on all monitors",
    dispatcher: "callback",
    argument: "NumpadShortcuts.consolidateGlobal"
  });
  result.push({
    modifiers: "SUPER + CTRL + SHIFT + ALT",
    key: "KP_Enter",
    description: "Consolidate workspaces on focused monitor",
    dispatcher: "callback",
    argument: "NumpadShortcuts.consolidateFocusedMonitor"
  });
  result.push({
    modifiers: "SUPER + CTRL",
    key: "KP_Divide",
    description: "Open Numpad Shortcuts guide",
    dispatcher: "guide",
    argument: ""
  });
  return result;
}

function bindingKeys(binding) {
  return binding.modifiers + " + " + binding.key;
}

function shellPath(path) {
  if (/^[A-Za-z0-9_./-]+$/.test(path)) return path;
  return "'" + path.replace(/'/g, "'\\''") + "'";
}

function luaString(value) {
  return '"' + value.replace(/[\\"\x00-\x1f\x7f]/g, function(character) {
    if (character === '"' || character === "\\") return "\\" + character;
    return "\\" + ("00" + character.charCodeAt(0)).slice(-3);
  }) + '"';
}

function applyScript(pluginLuaPath, guideLauncherPath) {
  var commands = [
    'hl.config({ ["input.numlock_by_default"] = true })',
    "dofile(" + luaString(pluginLuaPath) + ")"
  ];
  var all = bindings();
  for (var i = 0; i < all.length; i++) {
    var binding = all[i];
    var keys = bindingKeys(binding);
    commands.push("hl.unbind(\"" + keys + "\")");
    if (binding.dispatcher === "workspace") {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.focus({ workspace = \"" + binding.argument + "\" }), { description = \"" + binding.description + "\" })");
    } else if (binding.dispatcher === "move") {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.window.move({ workspace = \"" + binding.argument + "\" }), { description = \"" + binding.description + "\" })");
    } else if (binding.dispatcher === "exec") {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.exec_cmd(\"" + binding.argument + "\"), { description = \"" + binding.description + "\" })");
    } else if (binding.dispatcher === "guide") {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.exec_cmd(" + luaString(shellPath(guideLauncherPath)) + "), { description = \"" + binding.description + "\" })");
    } else {
      commands.push("hl.bind(\"" + keys + "\", " + binding.argument + ", { description = \"" + binding.description + "\" })");
    }
  }
  return commands.join("\n");
}

function guideSections() {
  function descriptionsFor(matches) {
    var selected = bindings().filter(matches);
    var descriptions = [];
    for (var i = 0; i < selected.length; i++) {
      if (descriptions.indexOf(selected[i].description) === -1) descriptions.push(selected[i].description);
    }
    return descriptions;
  }

  return [
    {
      title: "Switch focus",
      summary: "Super + keypad number",
      shortcuts: descriptionsFor(function(binding) { return binding.dispatcher === "workspace"; }),
      details: "Switch to a target workspace, occupied or empty. The illustration shows the focus outline moving to an occupied workspace while windows stay put."
    },
    {
      title: "Move a window",
      summary: "Super + Shift + keypad number",
      shortcuts: descriptionsFor(function(binding) { return binding.dispatcher === "move"; }),
      details: "Move the focused window to a target workspace, occupied or empty. The illustration shows it moving from its source to a blank target workspace."
    },
    {
      title: "Protect a window",
      summary: "Super + Ctrl + keypad Enter",
      shortcuts: descriptionsFor(function(binding) { return binding.description === "Toggle window consolidation protection"; }),
      details: "A notification confirms whether the focused window is protected from consolidation. Protection is session-only, with no persistent badge, and resets on a Hyprland configuration reload. You can still move it manually with Super + Shift + a keypad number."
    },
    {
      title: "Consolidate gaps",
      summary: "Super + Ctrl + Shift + keypad Enter",
      shortcuts: descriptionsFor(function(binding) { return binding.description.indexOf("Consolidate workspaces") === 0; }),
      details: "Consolidation shifts unprotected windows left into blank numeric workspaces. Protected windows stay put and can preserve gaps. Add Alt to limit consolidation to the focused monitor."
    }
  ];
}

function cleanupScript() {
  var all = bindings();
  var commands = [];
  for (var i = 0; i < all.length; i++) commands.push("hl.unbind(\"" + bindingKeys(all[i]) + "\")");
  return commands.join("\n");
}

function activeInstanceSignature(output, expectedSignature) {
  try {
    var instances = JSON.parse(output);
    if (!Array.isArray(instances) || instances.length === 0) return "";
    if (expectedSignature) {
      return instances.some(function(instance) {
        return instance && instance.instance === expectedSignature;
      }) ? expectedSignature : "";
    }
    return instances.length === 1 && instances[0] && typeof instances[0].instance === "string" ? instances[0].instance : "";
  } catch (error) {
    return "";
  }
}

function hyprctlEvalArguments(script, instanceSignature) {
  return ["--instance", instanceSignature, "eval", script];
}

function bindingsAreActive(output) {
  try {
    var activeBindings = JSON.parse(output);
    if (!Array.isArray(activeBindings)) return false;
    var modifierMasks = { SUPER: 64, CTRL: 4, SHIFT: 1, ALT: 8 };
    return bindings().every(function(expected) {
      var expectedMask = expected.modifiers.split(" + ").reduce(function(mask, modifier) {
        return mask | modifierMasks[modifier];
      }, 0);
      return activeBindings.some(function(binding) {
        return binding && binding.key === expected.key
          && binding.modmask === expectedMask
          && binding.submap === ""
          && binding.description === expected.description;
      });
    });
  } catch (error) {
    return false;
  }
}

if (typeof module !== "undefined") module.exports = {
  bindings: bindings,
  applyScript: applyScript,
  cleanupScript: cleanupScript,
  guideSections: guideSections,
  activeInstanceSignature: activeInstanceSignature,
  hyprctlEvalArguments: hyprctlEvalArguments,
  bindingsAreActive: bindingsAreActive
};
