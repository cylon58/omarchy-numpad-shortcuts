pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts

// Apps are smaller windows inside numbered workspaces, with stable colors.
RowLayout {
  id: strip
  required property var spaces
  spacing: 8
  Repeater {
    model: strip.spaces
    delegate: ColumnLayout {
      id: workspace
      required property var modelData
      Layout.fillWidth: true
      Layout.preferredWidth: 1
      spacing: 5
      Text {
        Layout.fillWidth: true
        text: "Workspace " + workspace.modelData.number
        color: "#b5c0d3"
        font.pixelSize: 12
        horizontalAlignment: Text.AlignHCenter
      }
      Rectangle {
        Layout.fillWidth: true
        Layout.preferredHeight: 62
        color: "#111722"
        radius: 8
        border.width: workspace.modelData.focused ? 2 : 1
        border.color: workspace.modelData.focused ? "#84bbff" : "#445067"
        Accessible.role: Accessible.Graphic
        Accessible.name: "Workspace " + workspace.modelData.number + ": "
          + (workspace.modelData.app || "empty")
          + (workspace.modelData.focused ? ", focused" : "")
          + (workspace.modelData.protectedWindow ? ", protected from consolidation" : "")
        Text {
          anchors.centerIn: parent
          visible: !workspace.modelData.app
          text: "Empty"
          color: "#8895ac"
          font.pixelSize: 13
        }
        Rectangle {
          anchors.centerIn: parent
          width: Math.min(parent.width - 18, 180)
          height: parent.height - 18
          visible: !!workspace.modelData.app
          radius: 4
          color: workspace.modelData.app === "Browser" ? "#284758"
            : workspace.modelData.app === "Notes" ? "#403d64" : "#55452e"
          border.color: workspace.modelData.app === "Browser" ? "#6cafbc"
            : workspace.modelData.app === "Notes" ? "#b3a7e8" : "#d7b679"
          Rectangle {
            anchors.left: parent.left; anchors.right: parent.right; anchors.top: parent.top
            anchors.margins: 1
            height: 14
            color: "#22ffffff"
            radius: 3
            Text { anchors.left: parent.left; anchors.leftMargin: 5; text: "• • •"; color: "#bac7dc"; font.pixelSize: 9 }
          }
          Text {
            anchors.centerIn: parent
            anchors.verticalCenterOffset: 5
            text: workspace.modelData.app
            font.pixelSize: 13
            font.bold: true
            color: "#f2f4fa"
          }
          Rectangle {
            visible: workspace.modelData.protectedWindow
            anchors.right: parent.right; anchors.top: parent.top; anchors.margins: 3
            width: 20; height: 21; radius: 4; color: "#f0c988"
            Rectangle { x: 6; y: 3; width: 8; height: 10; radius: 4; color: "transparent"; border.color: "#30291f"; border.width: 2 }
            Rectangle { x: 4; y: 9; width: 12; height: 9; radius: 2; color: "#30291f" }
          }
        }
      }
      Text {
        Layout.fillWidth: true
        visible: strip.spaces.some(function(space) { return space.focused })
        text: workspace.modelData.focused ? "YOU ARE HERE" : " "
        color: "#84bbff"
        font.pixelSize: 10
        font.bold: true
        horizontalAlignment: Text.AlignHCenter
      }
    }
  }
}
