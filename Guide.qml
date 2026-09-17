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
  property var launcherResult: ({ message: "", severity: "" })
  readonly property var sections: Model.guideSections()
  readonly property var shortcutRows: GuideModel.fullShortcutRows(Model.bindings())
  readonly property string launcherHelperPath: manifest && manifest.__sourceDir
    ? manifest.__sourceDir + "/bin/manage-launcher-entry"
    : decodeURIComponent(Qt.resolvedUrl("bin/manage-launcher-entry").toString().replace(/^file:\/\//, ""))
  readonly property string artworkExplanation: "Read the four panels from left to right: switch focus, move a window, protect a window, and consolidate gaps. A bright blue focus outline marks the focused workspace. A filled window glyph means that workspace is occupied; a dashed blank workspace is empty. Arrows show the focus changing, a window moving, or the before-and-after consolidation. The blue pin is the protection marker: that window stays put during consolidation."

  function open(_payloadJson) {
    opened = true
    Qt.callLater(function() { closeButton.forceActiveFocus() })
  }

  function close() {
    launcherConfirmation.close()
    opened = false
  }

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
    onExited: function(exitCode) {
      root.launcherResult = GuideModel.launcherState(exitCode, "install")
    }
  }

  component GuideText: TextEdit {
    Layout.fillWidth: true
    readOnly: true
    selectByMouse: true
    wrapMode: TextEdit.Wrap
    color: "#c8cedf"
    font.pixelSize: 14
    Accessible.role: Accessible.StaticText
    Accessible.name: text
  }

  component GuideButton: Button {
    palette.button: "#303849"
    palette.buttonText: "#f5f7ff"
    palette.highlight: "#72b5ff"
    palette.highlightedText: "#111722"
  }

  FloatingWindow {
    id: window
    visible: root.opened
    title: "Numpad Shortcuts"
    implicitWidth: 900
    implicitHeight: 760
    minimumSize: Qt.size(600, 480)
    color: "#171c26"

    onVisibleChanged: {
      if (!visible && root.opened) root.requestClose()
    }

    Shortcut {
      sequence: "Escape"
      enabled: root.opened
      onActivated: root.requestClose()
    }

    ColumnLayout {
      anchors.fill: parent
      anchors.margins: 24
      spacing: 16

      ScrollView {
        id: scroll
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: availableWidth
        clip: true

        ColumnLayout {
          width: scroll.availableWidth
          spacing: 16

          GuideText {
            text: "Numpad Shortcuts"
            color: "#f5f7ff"
            font.pixelSize: 30
            font.bold: true
          }
          GuideText {
            text: "Use the number pad to find your workspace, move a window, and tidy up without disturbing protected windows."
            font.pixelSize: 16
          }
          GuideText {
            text: "Open this guide: Super + Ctrl + Numpad Divide"
            color: "#8ac5ff"
          }

          Image {
            Layout.fillWidth: true
            Layout.preferredHeight: width * 3 / 8
            source: "assets/numpad-workspace-concepts.png"
            fillMode: Image.PreserveAspectFit
            smooth: true
            Accessible.role: Accessible.Graphic
            Accessible.name: "Four workspace concepts"
            Accessible.description: root.artworkExplanation
          }
          GuideText { text: root.artworkExplanation }

          GridLayout {
            Layout.fillWidth: true
            columns: width >= 740 ? 2 : 1
            columnSpacing: 12
            rowSpacing: 12

            Repeater {
              model: root.sections
              delegate: Rectangle {
                id: card
                required property var modelData
                Layout.fillWidth: true
                Layout.fillHeight: true
                implicitWidth: 320
                implicitHeight: cardContent.implicitHeight + 32
                color: "#222a38"
                radius: 12
                border.color: "#38465c"

                ColumnLayout {
                  id: cardContent
                  anchors.fill: parent
                  anchors.margins: 16
                  spacing: 8
                  GuideText {
                    text: card.modelData.summary
                    color: "#8ac5ff"
                    font.pixelSize: 13
                    font.bold: true
                  }
                  GuideText {
                    text: card.modelData.title
                    color: "#f5f7ff"
                    font.pixelSize: 19
                    font.bold: true
                  }
                  GuideText { text: card.modelData.details }
                }
              }
            }
          }

          GuideButton {
            text: "Show full shortcut list"
            checkable: true
            checked: root.fullListExpanded
            onClicked: root.fullListExpanded = checked
            Accessible.description: checked ? "Full shortcut list expanded" : "Full shortcut list collapsed"
          }

          ColumnLayout {
            visible: root.fullListExpanded
            Layout.fillWidth: true
            spacing: 12
            GuideText {
              text: "Key names separated by / are Num Lock on/off variants of the same shortcut. Numpad 0 selects workspace 10."
            }
            Repeater {
              model: root.shortcutRows
              delegate: ColumnLayout {
                id: shortcutRow
                required property var modelData
                Layout.fillWidth: true
                spacing: 3
                GuideText {
                  text: shortcutRow.modelData.shortcut
                  color: "#8ac5ff"
                  font.bold: true
                }
                GuideText { text: shortcutRow.modelData.action }
              }
            }
          }
        }
      }

      GuideText {
        visible: text.length > 0
        text: root.launcherResult.message
        color: root.launcherResult.severity === "error" ? "#ffbf99" : "#a9dbc5"
      }
      RowLayout {
        Layout.fillWidth: true
        GuideButton {
          text: "Add to launcher"
          enabled: !launcherProcess.running
          onClicked: launcherConfirmation.open()
        }
        Item { Layout.fillWidth: true }
        GuideButton {
          id: closeButton
          text: "Close"
          onClicked: root.requestClose()
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
        text: "Create a Numpad Shortcuts entry in your user applications folder? It opens this guide. Existing custom launcher entries will not be overwritten."
        wrapMode: Text.Wrap
      }
    }
  }
}
