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
      key: keys[0],
      description: "Switch to workspace " + keys[2],
      dispatcher: "workspace",
      argument: keys[2]
    });
    result.push({
      key: keys[1],
      description: "Switch to workspace " + keys[2],
      dispatcher: "workspace",
      argument: keys[2]
    });
  }

  result.push({
    key: "KP_Enter",
    description: "Open terminal",
    dispatcher: "exec",
    argument: "/usr/share/omarchy/bin/omarchy-launch-terminal"
  });
  return result;
}

function applyScript() {
  var commands = ["hl.config({ [\"input.numlock_by_default\"] = true })"];
  var all = bindings();
  for (var i = 0; i < all.length; i++) {
    var binding = all[i];
    var keys = "SUPER + " + binding.key;
    commands.push("hl.unbind(\"" + keys + "\")");
    if (binding.dispatcher === "workspace") {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.focus({ workspace = \"" + binding.argument + "\" }), { description = \"" + binding.description + "\" })");
    } else {
      commands.push("hl.bind(\"" + keys + "\", hl.dsp.exec_cmd(\"" + binding.argument + "\"), { description = \"" + binding.description + "\" })");
    }
  }
  return commands.join("\n");
}

function cleanupScript() {
  var all = bindings();
  var commands = [];
  for (var i = 0; i < all.length; i++) commands.push("hl.unbind(\"SUPER + " + all[i].key + "\")");
  return commands.join("\n");
}

function activeInstanceSignature(output) {
  try {
    var instances = JSON.parse(output);
    if (!Array.isArray(instances) || instances.length === 0) return "";
    return typeof instances[0].instance === "string" ? instances[0].instance : "";
  } catch (error) {
    return "";
  }
}

function hyprctlEvalArguments(script, instanceSignature) {
  return ["--instance", instanceSignature, "eval", script];
}

if (typeof module !== "undefined") module.exports = {
  bindings: bindings,
  applyScript: applyScript,
  cleanupScript: cleanupScript,
  activeInstanceSignature: activeInstanceSignature,
  hyprctlEvalArguments: hyprctlEvalArguments
};
