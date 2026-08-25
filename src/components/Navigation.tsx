import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutPanelTop, Server, Settings, SlidersHorizontal, ChevronDown, Check, Plus, Loader2, ArrowLeft, Layers, LayoutDashboard, ServerCrash, FileText, PanelLeftClose, PanelLeftOpen, User, LogOut } from "lucide-react";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import { useAuth } from "../context/Auth.context";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import Tooltip from "./ui/Tooltip";
import packageJson from "../../package.json";
import { useUnreadPatchNoteCount } from "../hooks/usePatchNoteBadge";

const IconSize = 'w-4 h-4'
const sectionLabelClass = "px-2 text-4xs font-medium uppercase tracking-widest text-tertiary-text-color"
// 키보드 포커스 링. NavLink/button 전부 동일하게 절제된 스타일로 재사용한다.
const focusRingClass = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-service-color"

const NAV_WIDTH_EXPANDED = '14rem'
const NAV_WIDTH_COLLAPSED = '3.5rem'
const COLLAPSE_STORAGE_KEY = 'opticsNavCollapsed'

const mainMenu = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className={IconSize} /> },
  { name: 'Settings', path: '/settings', icon: <Settings className={IconSize} /> },
  { name: 'Patch Notes', path: '/patch-notes', icon: <FileText className={IconSize} /> },
]

const workspaceMenu = [
  { name: 'Overview', path: '/overview', icon: <LayoutPanelTop className={IconSize} /> },
  { name: 'Agents', path: '/agents', icon: <Server className={IconSize} /> },
  { name: 'Services', path: '/services', icon: <ServerCrash className={IconSize} /> },
  // Settings 와 아이콘이 겹치지 않도록 워크스페이스 쪽은 SlidersHorizontal 을 쓴다.
  { name: 'Workspace Settings', path: '/workspace-settings', icon: <SlidersHorizontal className={IconSize} /> },
]

type View = 'main' | 'workspace'

const navItemClass = (isActive: boolean) =>
  `flex flex-row items-center gap-2.5 rounded-r-sm border-l-2 px-2.5 py-2 text-sm leading-tight cursor-pointer transition-colors duration-100 mt-1 ${focusRingClass} ${
    isActive
      ? 'border-service-color bg-surface-active-color text-primary-text-color'
      : 'border-service-color/0 text-secondary-text-color hover:bg-surface-hover-color hover:text-primary-text-color active:bg-surface-active-color'
  }`;

/**
 * 접힌 상태에서만 이름표를 씌운다.
 *
 * 슬라이드 패널(뷰 전환 영역)이 overflow-hidden 이라 absolute 로 직접 그리는
 * 툴팁은 잘려서 아예 보이지 않는다. 이미 이 문제를 피하려고 만들어진
 * ui/Tooltip(포털 기반, 뷰포트 클램프 포함)을 그대로 재사용한다.
 * 트리거가 원래 차지하던 가로 폭을 잃지 않도록 바깥에 w-full 래퍼를 두고
 * 안에서 다시 가운데 정렬한다.
 */
function TooltipIfCollapsed({ collapsed, label, disabled, children }: { collapsed: boolean; label: string; disabled?: boolean; children: ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <div className="flex w-full justify-center">
      <Tooltip label={label} side="right" disabled={disabled}>{children}</Tooltip>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  badge?: boolean;
}

/** 메뉴 한 줄. 접힘 여부에 따라 라벨을 숨기고 툴팁으로 대체하며, 액티브일 때 아이콘에 브랜드 액센트를 준다. */
function NavItem({ to, icon, label, collapsed, badge }: NavItemProps) {
  return (
    <TooltipIfCollapsed collapsed={collapsed} label={label}>
      <NavLink
        to={to}
        className={({ isActive }) => `${navItemClass(isActive)} ${collapsed ? 'justify-center px-0' : ''}`}
      >
        {({ isActive }) => (
          <>
            <span className={`relative shrink-0 ${isActive ? 'text-service-color' : 'text-current'}`}>
              {icon}
              {/* 확인하지 않은 패치노트가 있으면 아이콘 우상단에 점을 겹친다.
                  ring은 아이콘 선과 점이 붙어 보이지 않게 배경색으로 띄우는 용도다. */}
              {badge && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-service-color ring-2 ring-modal-background-color" />
              )}
            </span>
            {!collapsed && <span className="font-semibold text-current">{label}</span>}
          </>
        )}
      </NavLink>
    </TooltipIfCollapsed>
  );
}

export default function Navigation() {
  const { workspaces, currentWorkspace, isLoading, selectWorkspace } = useWorkspace();
  const { openModal } = useModal();
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('main');
  const unreadPatchNotes = useUnreadPatchNoteCount();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // 폭 전환은 CSS 변수(--nav-width) 하나로 처리한다. App.tsx 의 본문 여백도
  // 같은 변수를 읽으므로 여기서만 값을 바꾸면 레이아웃이 같이 따라온다.
  // 저장/렌더 전에 값을 적용해야 새로고침 시 깜빡임이 없어 useLayoutEffect 를 쓴다.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--nav-width', collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH_EXPANDED);
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    } catch {
      /* 저장 실패해도 이번 세션 동작에는 지장 없다. */
    }
  }, [collapsed]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (dropdownOpen || accountMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, accountMenuOpen]);

  function handleNewWorkspace() {
    openModal("새 워크스페이스 생성", <CreateWorkspaceModal />);
  }

  function toggleCollapsed() {
    // 접힌 상태에선 드롭다운을 띄울 자리가 없으니 토글할 때 같이 정리한다.
    setCollapsed(prev => !prev);
    setDropdownOpen(false);
    setAccountMenuOpen(false);
  }

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 min-h-[26rem] max-h-[48rem] h-5/7 w-[var(--nav-width)] border-r border-t border-b rounded-r-md border-border-color bg-modal-background-color flex flex-col transition-[width] duration-200 ease-out">

      {/* 상단 고정 영역: 브랜드 + 접기 토글. 뷰가 바뀌어도 슬라이드하지 않고 항상 같은 자리에 있다. */}
      <div className="shrink-0 px-3 pt-3">
        <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : 'items-center justify-between'}`}>
          <div className={collapsed ? '' : 'min-w-0 px-2'}>
            {/* 소문자 i 만 높이가 낮아 워드마크가 들쭉날쭉해 보인다.
                uppercase 로 캡 하이트를 맞추고, 붙어 보이지 않게 자간을 살짝 벌린다. */}
            <span className="text-primary-text-color font-extrabold text-base leading-none uppercase tracking-wider">
              {collapsed ? 'O' : 'OPTiCS'}
            </span>
          </div>

          {/* 접힘 여부와 무관하게 프로젝트 툴팁을 쓴다. 브라우저 기본 title 은 지연이 길고 톤도 겉돈다. */}
          <Tooltip label={collapsed ? '펼치기' : '접기'} side="right">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`shrink-0 flex items-center justify-center rounded-sm p-1.5 text-secondary-text-color hover:bg-surface-hover-color hover:text-primary-text-color active:bg-surface-active-color transition-colors duration-100 cursor-pointer ${focusRingClass}`}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </Tooltip>
        </div>

        {!collapsed && view === 'workspace' && (
          <div className="pt-2 relative" ref={dropdownRef}>
            <span className={`${sectionLabelClass} mb-1.5 block`}>Current workspace</span>
            <button
              onClick={() => { setDropdownOpen(prev => !prev); }}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              className={`w-full rounded-sm bg-modal-box-color border border-border-color hover:border-border-strong-color hover:bg-surface-hover-color transition-colors duration-100 cursor-pointer px-3 py-2 ${focusRingClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-left">
                  {currentWorkspace ? (
                    <>
                      <span className="text-primary-text-color font-semibold text-sm leading-tight block truncate">{currentWorkspace.workspaceName}</span>
                      <span className={`inline-flex items-center gap-1 text-3xs leading-tight mt-1 ${currentWorkspace.status === 'linked' ? 'text-service-color' : 'text-secondary-text-color'}`}>
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
              <div role="listbox" aria-label="워크스페이스 목록" className="absolute left-3 right-3 top-full mt-1 rounded-sm border border-border-color bg-modal-box-color z-10 overflow-hidden shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                {workspaces.length === 0 ? (
                  <div className="px-3 py-3 text-center">
                    <span className="text-xs text-secondary-text-color">No Workspace.</span>
                  </div>
                ) : (
                  workspaces.map((ws) => (
                    <button
                      key={ws.workspaceIndex}
                      type="button"
                      role="option"
                      aria-selected={currentWorkspace?.workspaceIndex === ws.workspaceIndex}
                      onClick={() => { selectWorkspace(ws.workspaceIndex); setDropdownOpen(false); }}
                      className={`group flex w-full items-center justify-between px-3 py-2 hover:bg-surface-hover-color cursor-pointer transition-colors duration-100 text-left ${focusRingClass}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-primary-text-color text-sm font-medium leading-tight block truncate">{ws.workspaceName}</span>
                        <span className={`text-3xs mt-0.5 block ${ws.status === 'linked' ? 'text-service-color' : 'text-secondary-text-color'}`}>
                          {ws.status === 'linked' ? 'Agent linked' : 'No agent linked'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                        {currentWorkspace?.workspaceIndex === ws.workspaceIndex && (
                          <Check className="w-3 h-3 text-service-color" />
                        )}
                      </div>
                    </button>
                  ))
                )}
                <div className="border-t border-border-color">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); handleNewWorkspace(); }}
                    className={`flex w-full items-center gap-1.5 px-3 py-2 hover:bg-surface-hover-color cursor-pointer transition-colors duration-100 text-secondary-text-color hover:text-primary-text-color text-left ${focusRingClass}`}
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span className="text-xs font-medium">New Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 border-t border-border-color" />
      </div>

      {/* 뷰 전환 영역: main/workspace 두 패널을 나란히 두고 가로로 슬라이드한다. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <nav
          aria-label="주 메뉴"
          aria-hidden={view !== 'main'}
          inert={view !== 'main'}
          className={`absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden px-3 pt-3 transition-transform duration-250 ease-out ${
            view === 'main' ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
        >
          {!collapsed && <span className={`${sectionLabelClass} mb-1 block`}>Menu</span>}
          <NavItem to={mainMenu[0].path} icon={mainMenu[0].icon} label={mainMenu[0].name} collapsed={collapsed} />
          <TooltipIfCollapsed collapsed={collapsed} label="Workspace">
            <button
              type="button"
              onClick={() => { setView('workspace'); setDropdownOpen(false); }}
              className={`flex flex-row items-center rounded-r-sm border-l-2 border-service-color/0 px-2.5 py-2 text-sm leading-tight cursor-pointer transition-colors duration-100 mt-1 text-secondary-text-color hover:bg-surface-hover-color hover:text-primary-text-color active:bg-surface-active-color ${focusRingClass} ${
                collapsed ? 'justify-center px-0' : 'w-full justify-between'
              }`}
            >
              <div className={`flex items-center ${collapsed ? '' : 'gap-2.5'}`}>
                <span className="shrink-0 text-current"><Layers className={IconSize} /></span>
                {!collapsed && <span className="font-semibold text-current">Workspace</span>}
              </div>
              {!collapsed && <ChevronDown className="w-3 h-3 text-secondary-text-color -rotate-90 shrink-0" />}
            </button>
          </TooltipIfCollapsed>
          <NavItem to={mainMenu[1].path} icon={mainMenu[1].icon} label={mainMenu[1].name} collapsed={collapsed} />
          <NavItem to={mainMenu[2].path} icon={mainMenu[2].icon} label={mainMenu[2].name} collapsed={collapsed} badge={unreadPatchNotes !== 0} />
        </nav>

        <nav
          aria-label="워크스페이스 메뉴"
          aria-hidden={view !== 'workspace'}
          inert={view !== 'workspace'}
          className={`absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden px-3 pt-3 transition-transform duration-250 ease-out ${
            view === 'workspace' ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
        >
          {/* 메인으로 돌아가는 유일한 출구라 접힘 상태에서도 반드시 남아야 한다. */}
          <TooltipIfCollapsed collapsed={collapsed} label="Main menu">
            <button
              onClick={() => { setView('main'); setDropdownOpen(false); }}
              className={`mb-2 flex items-center rounded-sm py-1.5 text-xs font-medium text-secondary-text-color hover:bg-surface-hover-color hover:text-primary-text-color active:bg-surface-active-color transition-colors duration-100 cursor-pointer ${focusRingClass} ${
                collapsed ? 'justify-center px-0' : 'w-full gap-1.5 px-2'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span>Main menu</span>}
            </button>
          </TooltipIfCollapsed>
          {!collapsed && <span className={`${sectionLabelClass} mb-1 block`}>Pages</span>}
          {workspaceMenu.map((m, i) => (
            <NavItem key={i} to={m.path} icon={m.icon} label={m.name} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Footer: 계정 슬롯 + 버전(패치노트 진입점) */}
      <div className="shrink-0 px-3 py-3 border-t border-border-color relative" ref={accountMenuRef}>
        {/* 계정 메뉴는 접힘 상태에서 트리거 바로 오른쪽에 열린다. 툴팁이 그 위를 덮으므로 열려 있는 동안은 끈다. */}
        <TooltipIfCollapsed collapsed={collapsed} label={user?.userDisplay ?? '계정'} disabled={accountMenuOpen}>
          <button
            type="button"
            onClick={() => setAccountMenuOpen(prev => !prev)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            className={`flex items-center gap-2 rounded-sm py-1 cursor-pointer transition-colors duration-100 hover:bg-surface-hover-color active:bg-surface-active-color ${focusRingClass} ${
              collapsed ? 'justify-center px-0' : 'w-full px-1'
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-active-color text-service-color">
              <User className="w-3.5 h-3.5" />
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1 text-left">
                {/* Auth.context 의 실제 로그인 유저. user 가 없으면(로딩 중) 자리표시만 보여준다. */}
                <span className="block truncate text-xs font-semibold text-primary-text-color">{user?.userDisplay ?? '...'}</span>
                <span className="block truncate text-3xs text-tertiary-text-color">{user?.userEmail ?? ''}</span>
              </span>
            )}
            {!collapsed && (
              <ChevronDown className={`w-3 h-3 shrink-0 text-secondary-text-color transition-transform duration-200 ${accountMenuOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
        </TooltipIfCollapsed>

        {/* 접힘 상태에선 사이드바 폭(3.5rem)에 계정 메뉴가 들어가지 않는다.
            위로 펼치는 대신 오른쪽 바깥으로 내보내 고정 폭을 준다. */}
        {accountMenuOpen && (
          <div
            role="menu"
            aria-label="계정 메뉴"
            className={`absolute rounded-sm border border-border-color bg-modal-box-color z-10 overflow-hidden shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
              collapsed ? 'bottom-2 left-full ml-2 w-40' : 'bottom-full left-3 right-3 mb-1'
            }`}
          >
            <NavLink
              to="/settings"
              role="menuitem"
              onClick={() => setAccountMenuOpen(false)}
              className={`flex w-full items-center gap-1.5 px-3 py-2 hover:bg-surface-hover-color cursor-pointer transition-colors duration-100 text-secondary-text-color hover:text-primary-text-color text-left text-xs font-medium ${focusRingClass}`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>프로필</span>
            </NavLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setAccountMenuOpen(false); logout(); }}
              className={`flex w-full items-center gap-1.5 px-3 py-2 hover:bg-surface-hover-color cursor-pointer transition-colors duration-100 text-secondary-text-color hover:text-primary-text-color text-left text-xs font-medium ${focusRingClass}`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>로그아웃</span>
            </button>
          </div>
        )}

        {!collapsed && (
          <>
            <span className="text-secondary-text-color font-semibold text-xs block leading-tight mt-2">OPTiCS Hub Console</span>
            {/* 버전 표시가 곧 패치노트 진입점이다. 메뉴를 늘리지 않고 자연스러운 자리에 붙인다. */}
            <NavLink
              to="/patch-notes"
              className={({ isActive }) =>
                `text-3xs hover:underline cursor-pointer transition-colors duration-100 ${focusRingClass} ${
                  isActive ? 'text-service-color' : 'text-tertiary-text-color hover:text-secondary-text-color'
                }`
              }
            >
              {packageJson.version} <span className="font-light">Dev</span>
            </NavLink>
          </>
        )}
      </div>

    </div>
  )
}
