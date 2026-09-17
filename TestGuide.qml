import QtQuick
import Quickshell
import "." as Plugin

// Run with QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software
// QT_QPA_PLATFORMTHEME= QT_QUICK_CONTROLS_STYLE=Basic qs -p TestGuide.qml
Item {
  id: harness
  property var guideWindow: null
  property int step: 0
  property int hides: 0
  property bool capturing: false
  property bool prepared: false
  readonly property int testWidth: Number(Quickshell.env("NUMPAD_TEST_WIDTH")) || 626
  readonly property int testHeight: Number(Quickshell.env("NUMPAD_TEST_HEIGHT")) || 688
  readonly property var cases: [
    { topic: 0, width: 626, height: 688, name: "focus" },
    { topic: 1, width: 626, height: 688, name: "move" },
    { topic: 2, width: 626, height: 688, name: "protect" },
    { topic: 3, width: 626, height: 688, name: "consolidate" },
    { topic: 3, width: 626, height: 688, name: "protected-gap", protect: true },
    { topic: 3, width: 626, height: 688, name: "monitor", local: true }
  ]
  function check(value, message) {
    if (!value) { console.error("FAIL:", message); Qt.exit(1); throw new Error(message) }
  }
  function find(item, predicate) {
    if (predicate(item)) return item
    var children = item.children || []
    for (var i = 0; i < children.length; i++) {
      var found = find(children[i], predicate)
      if (found) return found
    }
    return null
  }
  function named(name) {
    return find(guideWindow.contentItem, function(item) { return item.objectName === name })
  }
  function button(text) {
    return find(guideWindow.contentItem, function(item) { return item.text === text && item.clicked !== undefined })
  }
  Plugin.Guide { id: guide }
  Component.onCompleted: {
    check(!guide.opened && !guide.fullListExpanded, "starts hidden, list collapsed")
    guide.manifest = { id: "cylon58.numpad-shortcuts" }
    guide.shell = { hide: function(id) { harness.hides++; guide.close() } }
    guide.open("")
    for (var i = 0; i < guide.data.length; i++) {
      if (guide.data[i].title === "Numpad Shortcuts") guideWindow = guide.data[i]
    }
    check(guideWindow !== null, "guide window exists")
    guideWindow.width = testWidth
    guideWindow.height = testHeight
  }
  Timer {
    interval: 150
    repeat: true
    running: true
    onTriggered: {
      if (harness.capturing) return
      if (harness.step < harness.cases.length) {
        var scenario = harness.cases[harness.step]
        if (!harness.prepared) {
          harness.named("lesson-" + scenario.topic).clicked()
          guide.protectExample = !!scenario.protect
          guide.localOnly = !!scenario.local
          harness.check(guide.selectedLesson === scenario.topic, "topic selects matching example")
          harness.check(!guide.fullListExpanded, "topic collapses shortcut list")
          harness.prepared = true
          return
        }
        var result = harness.named("exampleResult")
        var viewport = harness.named("lessonViewport")
        harness.check(harness.guideWindow.width === harness.testWidth && harness.guideWindow.height === harness.testHeight, "actual test geometry")
        if (harness.testWidth >= 626) {
          var resultAt = result.mapToItem(viewport, 0, 0)
          harness.check(resultAt.y + result.height <= viewport.height + 1,
            scenario.name + ": the explanation below AFTER must fit without scrolling")
        }
        harness.capturing = true
        harness.named("guideSurface").grabToImage(function(image) {
          harness.check(image.saveToFile("/tmp/numpad-guide-" + scenario.name + "-" + harness.testWidth + ".png"), "save preview")
          harness.step++
          harness.prepared = false
          harness.capturing = false
        })
        return
      }

      var list = harness.button("Show full shortcut list")
      list.toggle(); list.clicked()
      harness.check(guide.fullListExpanded, "list expands")
      harness.button("Back to examples").toggle()
      harness.button("Back to examples").clicked()
      harness.check(!guide.fullListExpanded, "list closes")
      harness.button("Add to launcher").clicked()
      var dialog = null
      for (var d = 0; d < harness.guideWindow.contentItem.data.length; d++) {
        if (harness.guideWindow.contentItem.data[d].title === "Add to launcher?") dialog = harness.guideWindow.contentItem.data[d]
      }
      harness.check(dialog !== null && dialog.visible, "launcher asks first")
      dialog.reject()
      for (var p = 0; p < guide.data.length; p++) {
        if (guide.data[p].command !== undefined) harness.check(!guide.data[p].running && guide.data[p].command.length === 0, "cancel never starts installer")
      }
      harness.button("Close").clicked()
      harness.check(!guide.opened && harness.hides === 1, "close routes through shell")
      guide.open("")
      harness.guideWindow.visible = false
      harness.check(!guide.opened && harness.hides === 2, "native close routes through shell")
      console.log("PASS: six rendered scenarios at", harness.testWidth, harness.testHeight, "navigation, disclosure, confirmation cancel, and close")
      Qt.quit()
    }
  }
}
