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
  property string probedBindingInstance: ""
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
    if (!signature) return
    if (signature !== root.activeInstanceSignature) {
      root.activeInstanceSignature = signature
      root.applyBindings(signature)
      return
    }
    root.probeBindings(signature)
  }

  function probeBindings(instanceSignature) {
    if (bindingProbe.running) return
    root.probedBindingInstance = instanceSignature
    bindingProbe.command = [root.hyprctlPath, "--instance", instanceSignature, "-j", "binds"]
    bindingProbe.running = true
  }

  function handleBindings(output) {
    if (root.probedBindingInstance !== root.activeInstanceSignature) return
    var active = Model.bindingsAreActive(output)
    if (!active) root.applyBindings(root.activeInstanceSignature)
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
    interval: 2000
    repeat: true
    running: true
    onTriggered: root.probeInstance()
  }

  Process {
    id: bindingProbe
    running: false
    command: []
    clearEnvironment: true
    environment: root.safeEnvironment
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.handleBindings(text)
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) console.warn("Numpad Shortcuts: binding probe exited with " + exitCode)
    }
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
    onExited: function(exitCode) {
      if (exitCode !== 0) console.warn("Numpad Shortcuts: instance probe exited with " + exitCode)
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
