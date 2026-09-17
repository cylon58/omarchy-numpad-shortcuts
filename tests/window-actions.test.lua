local module_path = "WindowActions.lua"

local moves, dispatches, notifications

local function win(address, workspace_id, monitor, special)
  return {
    address = address,
    monitor = monitor,
    workspace = { id = workspace_id, monitor = monitor, special = special or false },
  }
end

local function fixture(state)
  moves, dispatches, notifications = {}, {}, {}
  NumpadShortcuts = nil
  local workspaces = state.workspaces or {}
  if not state.workspaces then
    for _, window in ipairs(state.windows or {}) do
      table.insert(workspaces, window.workspace)
    end
  end

  hl = {
    get_active_window = function() return state.active end,
    get_windows = function() return state.windows or {} end,
    get_workspaces = function() return workspaces end,
    get_active_monitor = function() return state.active_monitor end,
    dispatch = function(dispatcher)
      table.insert(dispatches, dispatcher)
      if dispatcher.kind == "move" then table.insert(moves, dispatcher.options) end
    end,
    dsp = {
      window = {
        move = function(options) return { kind = "move", options = options } end,
      },
    },
    notification = {
      create = function(options) table.insert(notifications, options.text) end,
    },
  }

  dofile(module_path)
  if state.protected then
    NumpadShortcuts.protected = state.protected
  end
end

local function assert_equal(actual, expected, message)
  assert(actual == expected, message or ("expected " .. tostring(expected) .. ", got " .. tostring(actual)))
end

local function assert_moves(expected)
  assert_equal(#moves, #expected, "wrong number of moves")
  for index, expectation in ipairs(expected) do
    local actual = moves[index]
    assert_equal(actual.window.address, expectation[1], "wrong moved window")
    assert_equal(actual.workspace, expectation[2], "wrong destination workspace")
    assert_equal(actual.follow, expectation[3], "move must not follow")
  end
end

local a, b = { id = 1, name = "DP-1" }, { id = 2, name = "HDMI-A-1" }

fixture({ active = win("0xaaa", 5, a), windows = { win("0xaaa", 5, a) } })
NumpadShortcuts.toggleProtection()
assert(NumpadShortcuts.protected["0xaaa"] == true)
NumpadShortcuts.toggleProtection()
assert(NumpadShortcuts.protected["0xaaa"] == nil)

fixture({ windows = { win("0x1", 1, a), win("0x3a", 3, a), win("0x3b", 3, a) } })
NumpadShortcuts.consolidateGlobal()
assert_moves({ { "0x3a", 2, false }, { "0x3b", 2, false } })

fixture({
  protected = { ["0xpin"] = true },
  windows = { win("0x1", 1, a), win("0xpin", 3, a), win("0xmove", 3, a) },
})
NumpadShortcuts.consolidateGlobal()
assert_moves({ { "0xmove", 2, false } })

fixture({
  active_monitor = a,
  workspaces = { { id = 1, monitor = a }, { id = 3, monitor = a } },
  windows = { win("0x3", 3, a) },
})
NumpadShortcuts.consolidateFocusedMonitor()
assert_moves({ { "0x3", 1, false } })

fixture({
  active_monitor = a,
  workspaces = { { id = 1, monitor = a }, { id = 2, monitor = b }, { id = 3, monitor = a } },
  windows = { win("0x1", 1, a), win("0x3", 3, a) },
})
NumpadShortcuts.consolidateFocusedMonitor()
assert_moves({})

fixture({
  active_monitor = a,
  windows = { win("0x1", 1, a), win("0x3", 3, a), win("0x2", 2, b) },
})
NumpadShortcuts.consolidateFocusedMonitor()
assert_moves({})

fixture({})
NumpadShortcuts.toggleProtection()
assert_equal(next(NumpadShortcuts.protected), nil)
assert_equal(notifications[1], "No focused window to protect")

fixture({
  protected = { ["0xstale"] = true },
  windows = { win("0x3", 3, a) },
})
NumpadShortcuts.consolidateGlobal()
assert_equal(NumpadShortcuts.protected["0xstale"], nil)
assert_moves({ { "0x3", 1, false } })

fixture({ windows = { win("0x1", 1, a) } })
NumpadShortcuts.consolidateGlobal()
assert_equal(notifications[1], "Workspaces are already compact")

fixture({ windows = { win("0x3", 3, a, true) } })
NumpadShortcuts.consolidateGlobal()
assert_moves({})
assert_equal(notifications[1], "Workspaces are already compact")

fixture({
  protected = { ["0xspecial"] = true },
  windows = { win("0xspecial", 20, a, true), win("0x3", 3, a) },
})
NumpadShortcuts.consolidateGlobal()
assert_equal(NumpadShortcuts.protected["0xspecial"], true, "live special windows retain protection")
assert_moves({ { "0x3", 1, false } })

fixture({ active = win("0xsession", 4, a), windows = { win("0xsession", 4, a) } })
NumpadShortcuts.toggleProtection()
dofile(module_path)
assert_equal(NumpadShortcuts.protected["0xsession"], true, "protection should survive a normal reapply")

print("window-actions tests: PASS")
