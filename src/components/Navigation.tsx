import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutPanelTop, Server, Users, Settings, Activity, ChevronDown, Check, Plus } from "lucide-react";

const IconSize = 'w-4 h-4'

const menu = [
  { name: 'Overview', path: '/overview', icon: <LayoutPanelTop className={IconSize} /> },
  { name: 'Agents', path: '/agents', icon: <Server className={IconSize} /> },
  { name: 'Users', path: '/users', icon: <Users className={IconSize} /> },
  { name: 'Activity', path: '/activity', icon: <Activity className={IconSize} /> },
  { name: 'Settings', path: '/settings', icon: <Settings className={IconSize} /> },
]

const workspaces = [
  { name: 'Production', agents: 12 },
  { name: 'Staging', agents: 3 },
  { name: 'Development', agents: 0 },
]

export default function Navigation() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0].name);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const current = workspaces.find(w => w.name === selectedWorkspace)!;

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 h-5/7 w-56 border-r border-t border-b rounded-r-md border-border-color bg-modal-background-color flex flex-col">

      {/* Workspace */}
      <div className="px-3 pt-4 relative">
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          className="w-full rounded-sm bg-modal-box-color border border-border-color hover:bg-white/5 transition-colors duration-100 cursor-pointer px-3 py-2"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-secondary-text-color font-medium uppercase tracking-widest">Workspace</span>
            <ChevronDown className={`w-3 h-3 text-secondary-text-color shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </div>
          <span className="text-primary-text-color font-semibold text-sm leading-tight block text-left">{current.name}</span>
          <span className={`text-[10px] leading-tight block text-left mt-0.5 ${current.agents > 0 ? 'text-service-color' : 'text-secondary-text-color'}`}>
            {current.agents > 0 ? `${current.agents} agents running` : 'No agents running'}
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-0.5 rounded-sm border border-border-color bg-modal-box-color z-10 overflow-hidden">
            {workspaces.map((ws) => (
              <div
                key={ws.name}
                onClick={() => { setSelectedWorkspace(ws.name); setDropdownOpen(false); }}
                className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-100"
              >
                <div>
                  <span className="text-primary-text-color text-sm leading-tight block">{ws.name}</span>
                  <span className={`text-[10px] mt-0.5 block ${ws.agents > 0 ? 'text-service-color' : 'text-secondary-text-color'}`}>
                    {ws.agents > 0 ? `${ws.agents} agents running` : 'No agents running'}
                  </span>
                </div>
                {selectedWorkspace === ws.name && <Check className="w-3 h-3 text-service-color shrink-0" />}
              </div>
            ))}
            <div className="border-t border-border-color">
              <div
                onClick={() => { setDropdownOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-100 text-secondary-text-color hover:text-primary-text-color"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span className="text-xs">New Workspace</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 mt-4 border-t border-border-color" />

      {/* Menu */}
      <nav className="px-3 mt-3 flex-1 overflow-y-auto overflow-x-hidden">
        <span className="text-[9px] text-secondary-text-color font-medium uppercase tracking-widest px-2 mb-1 block">Menu</span>
        {menu.map((m, index) => (
          <NavLink
            key={index}
            to={m.path}
            className={({ isActive }) =>
              `flex flex-row items-center px-2 py-2 hover:bg-white/10 cursor-pointer active:bg-white/7.5 rounded-l-sm transition-colors duration-100 mt-1 border-r-2 ${isActive ? 'border-service-color bg-white/10' : 'border-service-color/0'}`
            }
          >
            <span className="text-secondary-text-color mr-2.5">{m.icon}</span>
            <span className="text-primary-text-color font-semibold text-sm leading-tight">{m.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border-color">
        <span className="text-primary-text-color font-extrabold text-sm block leading-tight">OPTiCS Hub Console</span>
        <span className="text-[10px] text-secondary-text-color">v0.1 <span className="font-light">Dev</span></span>
      </div>

    </div>
  )
}
