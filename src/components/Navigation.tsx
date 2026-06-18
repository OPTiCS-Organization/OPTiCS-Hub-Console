import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutPanelTop, Server, Settings, ChevronDown, Check, Plus, Trash2, Loader2, ArrowLeft, Layers, LayoutDashboard, ServerCrash } from "lucide-react";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import packageJson from "../../package.json";

const IconSize = 'w-4 h-4'
const sectionLabelClass = "px-2 text-[9px] font-medium uppercase tracking-widest text-tertiary-text-color"

const mainMenu = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className={IconSize} /> },
  { name: 'Settings', path: '/settings', icon: <Settings className={IconSize} /> },
]

const workspaceMenu = [
  { name: 'Overview', path: '/overview', icon: <LayoutPanelTop className={IconSize} /> },
  { name: 'Agents', path: '/agents', icon: <Server className={IconSize} /> },
  { name: 'Services', path: '/services', icon: <ServerCrash className={IconSize} /> },
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
    openModal("새 워크스페이스 생성", <CreateWorkspaceModal />);
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

  const navItemClass = (isActive: boolean) =>
    `flex flex-row items-center gap-2.5 rounded-r-sm border-l-2 px-2.5 py-2 text-sm leading-tight cursor-pointer transition-colors duration-100 mt-1 ${
      isActive
        ? 'border-service-color bg-white/10 text-primary-text-color'
        : 'border-service-color/0 text-secondary-text-color hover:bg-white/7.5 hover:text-primary-text-color active:bg-white/10'
    }`;

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 h-5/7 w-56 border-r border-t border-b rounded-r-md border-border-color bg-modal-background-color flex flex-col">

      {view === 'workspace' && (
        <>
          <div className="px-3 pt-3">
            <button
              onClick={() => { setView('main'); setDropdownOpen(false); setConfirmDeleteIndex(null); }}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-secondary-text-color hover:bg-white/7.5 hover:text-primary-text-color active:bg-white/10 transition-colors duration-100 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Main menu</span>
            </button>
          </div>

          <div className="px-3 pt-2 relative" ref={dropdownRef}>
            <span className={`${sectionLabelClass} mb-1.5 block`}>Current workspace</span>
            <button
              onClick={() => { setDropdownOpen(prev => !prev); setConfirmDeleteIndex(null); }}
              className="w-full rounded-sm bg-modal-box-color border border-border-color hover:border-border-strong-color hover:bg-white/5 transition-colors duration-100 cursor-pointer px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-left">
                  {currentWorkspace ? (
                    <>
                      <span className="text-primary-text-color font-semibold text-sm leading-tight block truncate">{currentWorkspace.workspaceName}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] leading-tight mt-1 ${currentWorkspace.status === 'linked' ? 'text-service-color' : 'text-secondary-text-color'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${currentWorkspace.status === 'linked' ? 'bg-service-color' : 'bg-tertiary-text-color'}`} />
                        {currentWorkspace.status === 'linked' ? 'Agent linked' : 'No agent linked'}
                      </span>
                    </>
                  ) : (
                    <span className="text-secondary-text-color text-sm leading-tight block">No Active Workspace...</span>
                  )}
                </div>
                {isLoading
                  ? <Loader2 className="w-3.5 h-3.5 mt-0.5 text-secondary-text-color shrink-0 animate-spin" />
                  : <ChevronDown className={`w-3.5 h-3.5 mt-0.5 text-secondary-text-color shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                }
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute left-3 right-3 top-full mt-1 rounded-sm border border-border-color bg-modal-box-color z-10 overflow-hidden shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                {workspaces.length === 0 ? (
                  <div className="px-3 py-3 text-center">
                    <span className="text-xs text-secondary-text-color">No Workspace.</span>
                  </div>
                ) : (
                  workspaces.map((ws) => (
                    <div
                      key={ws.workspaceIndex}
                      onClick={() => { selectWorkspace(ws.workspaceIndex); setDropdownOpen(false); setConfirmDeleteIndex(null); }}
                      className="group flex items-center justify-between px-3 py-2 hover:bg-white/7.5 cursor-pointer transition-colors duration-100"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-primary-text-color text-sm font-medium leading-tight block truncate">{ws.workspaceName}</span>
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
                    className="flex items-center gap-1.5 px-3 py-2 hover:bg-white/7.5 cursor-pointer transition-colors duration-100 text-secondary-text-color hover:text-primary-text-color"
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span className="text-xs font-medium">New Workspace</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mx-3 mt-4 border-t border-border-color" />
        </>
      )}

      {/* 뷰 전환 영역 */}
      <nav className={`px-3 flex-1 overflow-y-auto overflow-x-hidden flex flex-col ${view === 'workspace' ? 'mt-3' : 'pt-4'}`}>

        {view === 'main' && (
          <>
            <div className="px-2 pb-3">
              <span className="text-primary-text-color font-extrabold text-base leading-none tracking-normal">OPTiCS</span>
              <span className="text-[10px] text-secondary-text-color block mt-1">Hub Console</span>
            </div>
            <span className={`${sectionLabelClass} mb-1 block`}>Menu</span>
            <NavLink
              to={mainMenu[0].path}
              className={({ isActive }) => navItemClass(isActive)}
            >
              <span className="shrink-0 text-current">{mainMenu[0].icon}</span>
              <span className="font-semibold text-current">{mainMenu[0].name}</span>
            </NavLink>
            <div
              onClick={() => { setView('workspace'); setDropdownOpen(false); setConfirmDeleteIndex(null); }}
              className="flex flex-row items-center justify-between rounded-r-sm border-l-2 border-service-color/0 px-2.5 py-2 text-sm leading-tight cursor-pointer transition-colors duration-100 mt-1 text-secondary-text-color hover:bg-white/7.5 hover:text-primary-text-color active:bg-white/10"
            >
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 text-current"><Layers className={IconSize} /></span>
                <span className="font-semibold text-current">Workspace</span>
              </div>
              <ChevronDown className="w-3 h-3 text-secondary-text-color -rotate-90 shrink-0" />
            </div>
            <NavLink
              to={mainMenu[1].path}
              className={({ isActive }) => navItemClass(isActive)}
            >
              <span className="shrink-0 text-current">{mainMenu[1].icon}</span>
              <span className="font-semibold text-current">{mainMenu[1].name}</span>
            </NavLink>
          </>
        )}

        {view === 'workspace' && (
          <>
            <span className={`${sectionLabelClass} mb-1 block`}>Pages</span>
            {workspaceMenu.map((m, i) => (
              <NavLink
                key={i}
                to={m.path}
                className={({ isActive }) => navItemClass(isActive)}
              >
                <span className="shrink-0 text-current">{m.icon}</span>
                <span className="font-semibold text-current">{m.name}</span>
              </NavLink>
            ))}
          </>
        )}

      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border-color">
        <span className="text-secondary-text-color font-semibold text-xs block leading-tight">OPTiCS Hub Console</span>
        <span className="text-[10px] text-tertiary-text-color">v{packageJson.version} <span className="font-light">Dev</span></span>
      </div>

    </div>
  )
}
