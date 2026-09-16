import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  readonly property string hyprctlPath: "/usr/bin/hyprctl"
  readonly property int commandTimeoutMs: 10000
  readonly property var safeEnvironment: ({
    "PATH": "/usr/bin:/bin",
    "LANG": "C.UTF-8",
    "LC_ALL": "C.UTF-8",
    "XDG_RUNTIME_DIR": Quickshell.env("XDG_RUNTIME_DIR") || "",
    "HYPRLAND_INSTANCE_SIGNATURE": Quickshell.env("HYPRLAND_INSTANCE_SIGNATURE") || ""
  })

  function commandFor(script) {
    return [hyprctlPath, "eval", script]
  }

  function applyBindings() {
    if (applyProcess.running) return;
    applyProcess.command = commandFor(Model.applyScript());
    applyProcess.running = true;
    deadline.restart();
  }

  Timer {
    id: deadline
    interval: root.commandTimeoutMs
    repeat: false
    onTriggered: {
      if (applyProcess.running) {
        console.warn("Numpad Shortcuts: hyprctl did not finish within " + root.commandTimeoutMs + "ms; stopping it.");
        applyProcess.running = false;
      }
    }
  }

  Timer {
    id: reapplyTimer
    interval: 100
    repeat: false
    onTriggered: root.applyBindings()
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      var name = String(event && event.name ? event.name : "");
      if (Model.shouldReapplyBindings(name)) reapplyTimer.restart();
    }
  }

  Process {
    id: applyProcess
    running: false
    command: []
    clearEnvironment: true
    environment: root.safeEnvironment
    onExited: function(exitCode, exitStatus) {
      deadline.stop();
      if (exitCode !== 0) console.warn("Numpad Shortcuts: hyprctl exited with " + exitCode + " (status " + exitStatus + ").");
    }
  }

  Component.onCompleted: applyBindings()
}
