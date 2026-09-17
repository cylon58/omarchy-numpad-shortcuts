-- Exhaust all blank / movable / protected combinations on workspaces 1–10.
-- Multi-window groups and monitor isolation are covered in window-actions.
local count = 0
for code = 0, 59048 do
  local windows, protection, occupied, moves = {}, {}, {}, {}
  local value = code
  for id = 1, 10 do
    local state = value % 3
    value = math.floor(value / 3)
    if state > 0 then
      local window = { address = "w" .. id, workspace = { id = id, special = false } }
      windows[#windows + 1] = window
      occupied[id] = window
      if state == 2 then protection[window.address] = true end
    end
  end
  NumpadShortcuts = { protected = protection }
  hl = {
    get_windows = function() return windows end,
    notification = { create = function() end },
    dsp = { window = { move = function(options) return options end } },
    dispatch = function(options)
      assert(not protection[options.window.address], "protected window moved")
      assert(options.workspace < options.window.workspace.id, "move is not leftward")
      assert(not occupied[options.workspace], "destination is not blank")
      assert(options.follow == false, "consolidation must not follow the window")
      occupied[options.window.workspace.id] = nil
      occupied[options.workspace] = options.window
      moves[#moves + 1] = options.workspace
      options.window.workspace.id = options.workspace
    end,
  }
  dofile("WindowActions.lua")
  NumpadShortcuts.consolidateGlobal()
  local previous = 0
  for _, target in ipairs(moves) do
    assert(target > previous, "moving groups changed order")
    previous = target
  end
  -- A second consolidation must not move an already compact arrangement.
  moves = {}
  NumpadShortcuts.consolidateGlobal()
  assert(#moves == 0, "consolidation is not idempotent")
  count = count + 1
end
print("Exhaustive consolidation audit: PASS (" .. count .. " layouts)")
