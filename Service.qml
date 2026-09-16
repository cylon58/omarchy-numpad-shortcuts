import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

Item {
  id: root

  readonly property string hyprctlPath: "/usr/bin/hyprctl"
  readonly property int commandTimeoutMs: 10000
  property string activeInstanceSignature: ""
  property string pendingInstanceSignature: ""
  readonly property var safeEnvironment: ({
    "PATH": "/usr/bin:/bin",
    "LANG": "C.UTF-8",
    "LC_ALL": "C.UTF-8",
    "XDG_RUNTIME_DIR": Quickshell.env("XDG_RUNTIME_DIR") || "",
    "HYPRLAND_INSTANCE_SIGNATURE": Quickshell.env("HYPRLAND_INSTANCE_SIGNATURE") || ""
  })

  function commandFor(script, instanceSignature) {
    return [hyprctlPath].concat(Model.hyprctlEvalArguments(script, instanceSignature))
  }

  function applyBindings(instanceSignature) {
    if (applyProcess.running) {
      root.pendingInstanceSignature = instanceSignature
      return
    }
    applyProcess.command = commandFor(Model.applyScript(), instanceSignature)
    applyProcess.running = true;
    deadline.restart();
  }

  function probeInstance() {
    if (!instanceProbe.running) instanceProbe.running = true
  }

  function handleInstances(output) {
    var signature = Model.activeInstanceSignature(output)
    if (!signature || signature === root.activeInstanceSignature) return
    root.activeInstanceSignature = signature
    root.applyBindings(signature)
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
    interval: 1000
    repeat: true
    running: true
    onTriggered: root.probeInstance()
  }

  Process {
    id: instanceProbe
    command: [root.hyprctlPath, "instances", "-j"]
    clearEnvironment: true
    environment: root.safeEnvironment
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handleInstances(text)
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
      if (root.pendingInstanceSignature) {
        var signature = root.pendingInstanceSignature
        root.pendingInstanceSignature = ""
        root.applyBindings(signature)
      }
    }
  }

  Component.onCompleted: probeInstance()
}
