import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutPanelTop, Server, Users, Settings, Activity, ChevronDown, Check, Plus, Trash2, Loader2, ArrowLeft, Layers, LayoutDashboard } from "lucide-react";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import CreateWorkspaceModal from "./CreateWorkspaceModal";

const IconSize = 'w-4 h-4'

const mainMenu = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className={IconSize} /> },
  { name: 'Settings', path: '/settings', icon: <Settings className={IconSize} /> },
]

const workspaceMenu = [
  { name: 'Overview', path: '/overview', icon: <LayoutPanelTop className={IconSize} /> },
  { name: 'Agents', path: '/agents', icon: <Server className={IconSize} /> },
  { name: 'Users', path: '/users', icon: <Users className={IconSize} /> },
  { name: 'Activity', path: '/activity', icon: <Activity className={IconSize} /> },
  { name: 'Workspace Settings', path: '/workspace-settings', icon: <Settings className={IconSize} /> },
]

type View = 'main' | 'workspace'

export default function Navigation() {
  const { workspaces, currentWorkspace, isLoading, selectWorkspace, deleteWorkspace } = useWorkspace();
  const { openModal } = useModal();
  const [view, setView] = useState<View>('main');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setConfirmDeleteIndex(null);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function handleNewWorkspace() {
    openModal("Create New Workspace", <CreateWorkspaceModal />);
  }

  async function handleDelete(e: React.MouseEvent, index: number) {
    e.stopPropagation();

    if (confirmDeleteIndex !== index) {
      setConfirmDeleteIndex(index);
      return;
    }

    setDeletingIndex(index);
    setConfirmDeleteIndex(null);
    try {
      await deleteWorkspace(index);
    } finally {
      setDeletingIndex(null);
    }
  }

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 h-5/7 w-56 border-r border-t border-b rounded-r-md border-border-color bg-modal-background-color flex flex-col">

      {/* Workspace 고정 영역 */}
      <div className="px-3 pt-4 relative" ref={dropdownRef}>
        <button
          onClick={() => { setDropdownOpen(prev => !prev); setConfirmDeleteIndex(null); }}
          className="w-full rounded-sm bg-modal-box-color border border-border-color hover:bg-white/5 transition-colors duration-100 cursor-pointer px-3 py-2"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-secondary-text-color font-medium uppercase tracking-widest">Workspace</span>
            {isLoading
              ? <Loader2 className="w-3 h-3 text-secondary-text-color shrink-0 animate-spin" />
              : <ChevronDown className={`w-3 h-3 text-secondary-text-color shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            }
          </div>
          {currentWorkspace ? (
            <>
              <span className="text-primary-text-color font-semibold text-sm leading-tight block text-left">{currentWorkspace.workspaceName}</span>
              <span className={`text-[10px] leading-tight block text-left mt-0.5 ${currentWorkspace.status === 'linked' ? 'text-service-color' : 'text-secondary-text-color'}`}>
                {currentWorkspace.status === 'linked' ? 'Agent linked' : 'No agent linked'}
              </span>
            </>
          ) : (
            <span className="text-secondary-text-color text-sm leading-tight block text-left">No Active Workspace...</span>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-0.5 rounded-sm border border-border-color bg-modal-box-color z-10 overflow-hidden">
            {workspaces.length === 0 ? (
              <div className="px-3 py-3 text-center">
                <span className="text-xs text-secondary-text-color">No Workspace.</span>
              </div>
            ) : (
              workspaces.map((ws) => (
                <div
                  key={ws.workspaceIndex}
                  onClick={() => { selectWorkspace(ws.workspaceIndex); setDropdownOpen(false); setConfirmDeleteIndex(null); }}
                  className="group flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer transition-colors duration-100"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-primary-text-color text-sm leading-tight block truncate">{ws.workspaceName}</span>
                    <span className={`text-[10px] mt-0.5 block ${ws.status === 'linked' ? 'text-service-color' : 'text-secondary-text-color'}`}>
                      {ws.status === 'linked' ? 'Agent linked' : 'No agent linked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                    {currentWorkspace?.workspaceIndex === ws.workspaceIndex && (
                      <Check className="w-3 h-3 text-service-color" />
                    )}
                    {deletingIndex === ws.workspaceIndex ? (
                      <Loader2 className="w-3 h-3 text-secondary-text-color animate-spin" />
                    ) : (
                      <button
                        onClick={e => handleDelete(e, ws.workspaceIndex)}
                        title={confirmDeleteIndex === ws.workspaceIndex ? "Click again to confirm" : "Delete"}
                        className={`p-0.5 rounded transition-colors duration-100 cursor-pointer
                          ${confirmDeleteIndex === ws.workspaceIndex
                            ? 'text-red-400 bg-red-500/20'
                            : 'text-secondary-text-color/0 group-hover:text-secondary-text-color hover:text-red-400!'
                          }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="border-t border-border-color">
              <div
                onClick={() => { setDropdownOpen(false); handleNewWorkspace(); }}
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

      {/* 뷰 전환 영역 */}
      <nav className="px-3 mt-3 flex-1 overflow-y-auto overflow-x-hidden flex flex-col">

        {view === 'main' && (
          <>
            <span className="text-[9px] text-secondary-text-color font-medium uppercase tracking-widest px-2 mb-1 block">Menu</span>
            {mainMenu.map((m, i) => (
              <NavLink
                key={i}
                to={m.path}
                className={({ isActive }) =>
                  `flex flex-row items-center px-2 py-2 hover:bg-white/10 cursor-pointer active:bg-white/7.5 rounded-l-sm transition-colors duration-100 mt-1 border-r-2 ${isActive ? 'border-service-color bg-white/10' : 'border-service-color/0'}`
                }
              >
                <span className="text-secondary-text-color mr-2.5">{m.icon}</span>
                <span className="text-primary-text-color font-semibold text-sm leading-tight">{m.name}</span>
              </NavLink>
            ))}
            <div
              onClick={() => { setView('workspace'); setConfirmDeleteIndex(null); }}
              className="flex flex-row items-center justify-between px-2 py-2 hover:bg-white/10 cursor-pointer active:bg-white/7.5 rounded-l-sm transition-colors duration-100 mt-1 border-r-2 border-service-color/0"
            >
              <div className="flex items-center">
                <span className="text-secondary-text-color mr-2.5"><Layers className={IconSize} /></span>
                <span className="text-primary-text-color font-semibold text-sm leading-tight">Workspace</span>
              </div>
              <ChevronDown className="w-3 h-3 text-secondary-text-color -rotate-90 shrink-0" />
            </div>
          </>
        )}

        {view === 'workspace' && (
          <>
            <button
              onClick={() => { setView('main'); setConfirmDeleteIndex(null); }}
              className="flex items-center gap-1.5 px-2 py-1.5 mb-2 text-secondary-text-color hover:text-primary-text-color transition-colors duration-100 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3 shrink-0" />
              <span className="text-xs">Back</span>
            </button>

            <span className="text-[9px] text-secondary-text-color font-medium uppercase tracking-widest px-2 mb-1 block">Pages</span>
            {workspaceMenu.map((m, i) => (
              <NavLink
                key={i}
                to={m.path}
                className={({ isActive }) =>
                  `flex flex-row items-center px-2 py-2 hover:bg-white/10 cursor-pointer active:bg-white/7.5 rounded-l-sm transition-colors duration-100 mt-1 border-r-2 ${isActive ? 'border-service-color bg-white/10' : 'border-service-color/0'}`
                }
              >
                <span className="text-secondary-text-color mr-2.5">{m.icon}</span>
                <span className="text-primary-text-color font-semibold text-sm leading-tight">{m.name}</span>
              </NavLink>
            ))}
          </>
        )}

      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border-color">
        <span className="text-primary-text-color font-extrabold text-sm block leading-tight">OPTiCS Hub Console</span>
        <span className="text-[10px] text-secondary-text-color">v0.1 <span className="font-light">Dev</span></span>
      </div>

    </div>
  )
}
