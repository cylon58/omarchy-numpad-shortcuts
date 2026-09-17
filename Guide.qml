pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import "Model.js" as Model
import "GuideModel.js" as GuideModel

Item {
  id: root
  property var shell: null
  property var manifest: null
  property var service: null
  property bool opened: false
  property bool fullListExpanded: false
  property int selectedLesson: 0
  property bool localOnly: false
  property bool protectExample: false
  property var launcherResult: ({ message: "", severity: "" })
  readonly property var sections: Model.guideSections()
  readonly property var example: GuideModel.lesson(selectedLesson, localOnly, protectExample)
  readonly property var shortcutRows: GuideModel.fullShortcutRows(Model.bindings())
  readonly property string launcherHelperPath: manifest && manifest.__sourceDir
    ? manifest.__sourceDir + "/bin/manage-launcher-entry"
    : decodeURIComponent(Qt.resolvedUrl("bin/manage-launcher-entry").toString().replace(/^file:\/\//, ""))

  function open(_payloadJson) {
    opened = true
    Qt.callLater(function() { closeButton.forceActiveFocus() })
  }
  function close() { launcherConfirmation.close(); opened = false }
  function requestClose() {
    if (shell && typeof shell.hide === "function" && manifest && manifest.id) shell.hide(manifest.id)
    else close()
  }
  function installLauncher() {
    if (launcherProcess.running) return
    launcherResult = { message: "Adding launcher entry…", severity: "" }
    launcherProcess.command = [root.launcherHelperPath, "install"]
    launcherProcess.running = true
  }

  Process {
    id: launcherProcess
    running: false
    command: []
    onExited: function(exitCode) { root.launcherResult = GuideModel.launcherState(exitCode, "install") }
  }

  component Copy: Text {
    Layout.fillWidth: true
    wrapMode: Text.Wrap
    color: "#b5c0d3"
    font.family: "sans-serif"
    font.pixelSize: 14
    lineHeight: 1.15
    textFormat: Text.PlainText
  }
  component ActionButton: Button {
    id: button
    implicitHeight: 36
    implicitWidth: contentItem.implicitWidth + 26
    padding: 10
    contentItem: Text {
      text: button.text
      color: button.enabled ? "#eaf0fb" : "#78859a"
      font.pixelSize: 13
      horizontalAlignment: Text.AlignHCenter
      verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
      radius: 6
      color: button.down ? "#34435b" : button.hovered ? "#2a374c" : "#202c3e"
      border.color: button.activeFocus ? "#84bbff" : "#3c4b62"
    }
  }

  FloatingWindow {
    id: window
    visible: root.opened
    title: "Numpad Shortcuts"
    implicitWidth: 760
    implicitHeight: 840
    minimumSize: Qt.size(460, 480)
    color: "#101620"
    onVisibleChanged: { if (!visible && root.opened) root.requestClose() }
    Shortcut { sequence: "Escape"; enabled: root.opened && !launcherConfirmation.visible; onActivated: root.requestClose() }

    Rectangle {
      objectName: "guideSurface"
      anchors.fill: parent
      color: window.color
    ColumnLayout {
      anchors.top: parent.top
      anchors.bottom: parent.bottom
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.margins: window.width < 550 ? 16 : 22
      width: Math.min(parent.width - (window.width < 550 ? 32 : 44), 760)
      spacing: 10

      RowLayout {
        Layout.fillWidth: true
        Copy { text: "Numpad Shortcuts"; color: "#f3f5fb"; font.pixelSize: 26; font.bold: true }
        Text { text: "1–9  ·  0 = 10"; color: "#84bbff"; font.pixelSize: 13 }
      }
      Copy { text: "Examples only — these controls don’t move your windows. Numbered boxes are workspaces; smaller boxes inside are windows."; font.pixelSize: 13 }

      // Navigation stays visible while the example and shortcut list scroll.
      GridLayout {
        Layout.fillWidth: true
        columns: 2
        columnSpacing: 8
        rowSpacing: 8
        Repeater {
          model: root.sections
          delegate: Button {
            id: topic
            required property int index
            required property var modelData
            objectName: "lesson-" + index
            Layout.fillWidth: true
            Layout.preferredWidth: 1
            implicitHeight: 36
            padding: 10
            checkable: true
            checked: root.selectedLesson === index
            Accessible.name: modelData.title
            onClicked: {
              root.selectedLesson = index
              root.fullListExpanded = false
              scroll.contentItem.contentY = 0
            }
            contentItem: Text {
              text: (topic.index + 1) + "   " + topic.modelData.title
              font.pixelSize: 14
              font.bold: topic.checked
              color: topic.checked ? "#e6f1ff" : "#b5c0d3"
              verticalAlignment: Text.AlignVCenter
            }
            background: Rectangle {
              radius: 7
              color: topic.checked ? "#253d5b" : topic.hovered ? "#233044" : "#1a2433"
              border.color: topic.checked || topic.activeFocus ? "#84bbff" : "#344158"
            }
          }
        }
      }

      ScrollView {
        id: scroll
        objectName: "lessonViewport"
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: availableWidth
        clip: true
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
        ColumnLayout {
          width: scroll.availableWidth
          spacing: 12
          Rectangle {
            visible: !root.fullListExpanded
            Layout.fillWidth: true
            implicitHeight: lessonBody.implicitHeight + 28
            color: "#1a2332"
            radius: 10
            border.color: "#344158"
            ColumnLayout {
              id: lessonBody
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.margins: 14
              spacing: 6
              Copy { text: root.sections[root.selectedLesson].title; font.pixelSize: 20; font.bold: true; color: "#f3f5fb" }
              Copy {
                text: root.selectedLesson === 3 ? root.example.action : root.sections[root.selectedLesson].summary.replace(/keypad/g, "Numpad")
                color: "#84bbff"; font.pixelSize: 13
              }
              RowLayout {
                visible: root.selectedLesson === 3
                ActionButton { text: root.localOnly ? "All monitors" : "✓ All monitors"; onClicked: root.localOnly = false }
                ActionButton { text: root.localOnly ? "✓ This monitor" : "This monitor"; onClicked: root.localOnly = true }
                ActionButton {
                  text: root.protectExample ? "✓ Protect Photos" : "Protect Photos"
                  checkable: true
                  checked: root.protectExample
                  onClicked: root.protectExample = checked
                  Accessible.description: "Example only: show how a protected window leaves a gap"
                }
              }
              Copy { text: "BEFORE"; font.pixelSize: 10; font.bold: true }
              WorkspaceStrip { Layout.fillWidth: true; spaces: root.example.before }
              Rectangle {
                Layout.fillWidth: true
                implicitHeight: actionText.implicitHeight + 16
                color: "#253d5b"
                radius: 5
                Text {
                  id: actionText
                  anchors.left: parent.left
                  anchors.right: parent.right
                  anchors.margins: 10
                  anchors.verticalCenter: parent.verticalCenter
                  text: "↓  Press " + root.example.action
                  wrapMode: Text.Wrap
                  color: "#daebff"
                  font.pixelSize: 13
                  font.bold: true
                  textFormat: Text.PlainText
                }
              }
              Copy { text: "AFTER"; font.pixelSize: 10; font.bold: true }
              WorkspaceStrip { Layout.fillWidth: true; spaces: root.example.after }
              Copy { objectName: "exampleResult"; text: root.example.result; color: "#e5ecf7"; font.pixelSize: 14; font.bold: true }
            }
          }
          Copy { visible: !root.fullListExpanded; text: root.example.note; font.pixelSize: 13 }
          ColumnLayout {
            visible: root.fullListExpanded
            Layout.fillWidth: true
            spacing: 10
            Copy { text: "Full shortcut list"; font.pixelSize: 20; color: "#f3f5fb"; font.bold: true }
            Copy { text: "Num Lock can be on or off. Names separated by / are two names for the same keypad key."; font.pixelSize: 13 }
            Repeater {
              model: root.shortcutRows
              delegate: ColumnLayout {
                required property var modelData
                Layout.fillWidth: true
                spacing: 3
                Copy { text: parent.modelData.shortcut; color: "#84bbff"; font.pixelSize: 13 }
                Copy { text: parent.modelData.action; font.pixelSize: 13 }
              }
            }
          }
        }
      }
      Copy { visible: text.length > 0; text: root.launcherResult.message; color: root.launcherResult.severity === "error" ? "#ffbf99" : "#a9dbc5"; font.pixelSize: 12 }
      RowLayout {
        Layout.fillWidth: true
        ActionButton {
          text: root.fullListExpanded ? "Back to examples" : "Show full shortcut list"
          checkable: true
          checked: root.fullListExpanded
          onClicked: {
            root.fullListExpanded = checked
            scroll.contentItem.contentY = 0
          }
        }
        Item { Layout.fillWidth: true }
        ActionButton { text: "Add to launcher"; enabled: !launcherProcess.running; onClicked: launcherConfirmation.open() }
        ActionButton { id: closeButton; text: "Close"; onClicked: root.requestClose() }
      }
    }
    }
    Dialog {
      id: launcherConfirmation
      anchors.centerIn: parent
      width: Math.min(480, window.width - 48)
      title: "Add to launcher?"
      modal: true
      standardButtons: Dialog.Yes | Dialog.Cancel
      onAccepted: root.installLauncher()
      contentItem: Label {
        text: "Add Numpad Shortcuts to your app launcher? It will open this guide."
        wrapMode: Text.Wrap
      }
    }
  }
}
