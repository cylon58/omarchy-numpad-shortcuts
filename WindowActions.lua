NumpadShortcuts = NumpadShortcuts or { protected = {} }
NumpadShortcuts.protected = NumpadShortcuts.protected or {}

local function notify(text)
  hl.notification.create({ text = text, timeout = 2000 })
end

local function move(window, workspace)
  hl.dispatch(hl.dsp.window.move({ window = window, workspace = workspace, follow = false }))
end

local function eligible(window)
  local workspace = window.workspace
  local id = workspace and workspace.id
  return workspace and not workspace.special and type(id) == "number" and id % 1 == 0 and id >= 1 and id <= 10
end

local function prune_protection(windows)
  local live = {}
  for _, window in ipairs(windows) do live[window.address] = true end
  for address in pairs(NumpadShortcuts.protected) do
    if not live[address] then NumpadShortcuts.protected[address] = nil end
  end
end

local function consolidate(windows, blocked)
  local by_source = {}
  blocked = blocked or {}

  for _, window in ipairs(windows) do
    local source = window.workspace.id
    by_source[source] = by_source[source] or {}
    table.insert(by_source[source], window)
    if NumpadShortcuts.protected[window.address] then blocked[source] = true end
  end

  local moved = 0
  for source = 1, 10 do
    local group = {}
    for _, window in ipairs(by_source[source] or {}) do
      if not NumpadShortcuts.protected[window.address] then table.insert(group, window) end
    end

    if #group > 0 then
      local target
      for candidate = 1, source - 1 do
        if not blocked[candidate] then
          target = candidate
          break
        end
      end

      if target then
        blocked[target] = true
        for _, window in ipairs(group) do
          move(window, target)
          moved = moved + 1
        end
      else
        blocked[source] = true
      end
    end
  end

  if moved == 0 then
    notify("Workspaces are already compact")
  else
    notify("Consolidated " .. moved .. " window(s)")
  end
end

function NumpadShortcuts.toggleProtection()
  local window = hl.get_active_window()
  if not window then
    notify("No focused window to protect")
    return
  end

  local address = window.address
  if NumpadShortcuts.protected[address] then
    NumpadShortcuts.protected[address] = nil
    notify("Window can move during consolidation")
  else
    NumpadShortcuts.protected[address] = true
    notify("Window protected from consolidation")
  end
end

function NumpadShortcuts.consolidateGlobal()
  local all_windows = hl.get_windows()
  prune_protection(all_windows)
  local windows = {}
  for _, window in ipairs(all_windows) do
    if eligible(window) then table.insert(windows, window) end
  end
  consolidate(windows)
end

function NumpadShortcuts.consolidateFocusedMonitor()
  local active_monitor = hl.get_active_monitor()
  if not active_monitor then
    notify("No active monitor to consolidate")
    return
  end

  local all_windows = hl.get_windows()
  prune_protection(all_windows)
  local blocked, windows = {}, {}
  for _, workspace in ipairs(hl.get_workspaces()) do
    if workspace.monitor ~= active_monitor then blocked[workspace.id] = true end
  end
  for _, window in ipairs(all_windows) do
    if window.monitor == active_monitor and eligible(window) then table.insert(windows, window) end
  end
  consolidate(windows, blocked)
end
