/**
 * 패치노트. 릴리스와 함께 배포되므로 별도 API 없이 이 파일만 수정한다.
 *
 * 새 항목은 배열 맨 앞에 추가한다. version 은 package.json 의 값과 맞춘다.
 */

export type ChangeKind = "added" | "changed" | "fixed" | "security";

export interface ComponentVersionChange {
  scope: string;
  from: string;
  to: string;
}

export interface PatchNoteEntry {
  version: string;
  codename: string | undefined;
  /** YYYY-MM-DD */
  date: string;
  /** 사용자가 반드시 알아야 하는 변경이면 true. 목록에서 강조된다. */
  highlight?: boolean;
  /** 업그레이드 전 반드시 읽어야 하는 경고 (예: 다른 컴포넌트 수동 업그레이드 필요). */
  warning?: string;
  /** 컴포넌트별 버전 변경 표. Hub 외 Agent/Installer 등도 함께 릴리스될 때만 채운다. */
  versions?: ComponentVersionChange[];
  changes: { kind: ChangeKind; description: string }[];
}

export const changeKindLabel: Record<ChangeKind, string> = {
  added: "추가",
  changed: "변경",
  fixed: "수정",
  security: "보안",
};

/** 배지 색. 액센트(주황)는 추가에만 쓰고 나머지는 저채도로 눌러 둔다. */
export const changeKindClass: Record<ChangeKind, string> = {
  added: "bg-service-color/15 text-service-color",
  changed: "bg-white/7.5 text-secondary-text-color",
  fixed: "bg-success-color/15 text-success-color",
  security: "bg-warning-color/15 text-warning-color",
};

/** 항목을 kind별로 묶어 보여줄 때 그룹 헤더에 쓰는 점 색. changeKindClass와 같은 색 규칙을 따른다. */
export const changeKindDotClass: Record<ChangeKind, string> = {
  added: "bg-service-color",
  changed: "bg-secondary-text-color",
  fixed: "bg-success-color",
  security: "bg-warning-color",
};

/** 항목을 kind별로 묶어 보여줄 때의 그룹 순서. */
export const changeKindOrder: ChangeKind[] = ["added", "changed", "fixed", "security"];

export const patchNotes: PatchNoteEntry[] = [
  {
    version: "0.5.4",
    codename: undefined,
    date: "2026-08-19",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.3", to: "0.5.4"},
      { scope: "OPTiCS Console", from: "0.5.3", to: "0.5.4" },
    ],
    changes: [
      { kind: 'fixed', description: "OPTiCS Hub 0.5.3 패치 이후 배포 대상이 변경된 Service 상태 추적이 되지 않던 문제를 수정했습니다." }
    ]
  },
  {
    version: "0.5.3",
    codename: undefined,
    date: "2026-08-19",
    warning: "이 업데이트를 적용하려면 OPTiCS Agent 0.5.3 수동 업그레이드가 필요합니다.",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.2", to: "0.5.3"},
      { scope: "OPTiCS Console", from: "0.5.2", to: "0.5.3" },
      { scope: "OPTiCS Agent", from: "0.5.0", to: "0.5.3" }
    ],
    changes: [
      { kind: "changed", description: "OPTiCS Agent 백엔드의 동작 안정성이 개선되었습니다." },
      { kind: "fixed", description: "OPTiCS Hub 0.5.2에서 수정한 재배포 시 Agent 변경 파라미터가 적용되지 않는 문제가 일부 조건에서 남아 있어 추가로 수정했습니다." },
      { kind: "changed", description: "OPTiCS Console의 Service Detail 페이지의 기본 탭이 로그에서 개요로 변경되었습니다." },
      { kind: "fixed", description: "OPTiCS Console의 Service Detail/로그 탭의 로그 렌더링 성능을 개선했습니다." },
      { kind: "added", description: "OPTiCS Console의 Patch Note 탭에 읽음 여부를 표시하는 기능을 추가했습니다." },
    ]
  },
  {
    version: "0.5.2",
    codename: undefined,
    date: "2026-08-14",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.1", to: "0.5.2" },
    ],
    changes: [
      { kind: "fixed", description: "OPTiCS Console에서 Service 재배포 시 배포 대상 Agent 변경 파라미터가 적용되지 않던 문제를 수정했습니다" },
    ]
  },
  {
    version: "0.5.1",
    codename: undefined,
    date: "2026-08-13",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.0", to: "0.5.1" },
      { scope: "OPTiCS Console", from: "0.5.0", to: "0.5.1" },
    ],
    changes: [
      { kind: "fixed", description: "OPTiCS Console에서 불필요한 UI 요소를 삭제했습니다." },
      { kind: "security", description: "OPTiCS Hub CSRF 보안 취약점을 패치했습니다." },
    ]
  },
  {
    version: "0.5.0",
    codename: "Airglow",
    date: "2026-08-11",
    warning: "이 업데이트를 적용하려면 OPTiCS Agent 0.5.0 수동 업그레이드가 필요합니다.",
    versions: [
      { scope: "OPTiCS Hub", from: "0.4.0", to: "0.5.0" },
      { scope: "OPTiCS Console", from: "0.3.1", to: "0.5.0" },
      { scope: "OPTiCS Agent", from: "0.3.0", to: "0.5.0" },
      { scope: "OPTiCS Installer (Linux)", from: "0.2.0", to: "0.3.3" },
      { scope: "OPTiCS Installer (Windows)", from: "0.2.0", to: "0.2.0" },
    ],
    changes: [
      { kind: "added", description: "회원가입 시 SMTP 이메일 인증 절차가 추가되었습니다. 가입 주소로 받은 링크를 눌러야 가입을 완료할 수 있습니다." },
      { kind: "security", description: "이메일 인증 도입 이전에 가입한 계정은 재인증이 필요합니다. 콘솔 상단 안내에서 인증 메일을 받아 완료해 주세요." },
      { kind: "added", description: "인증 메일 재발송에 90초 대기 시간이 적용됩니다." },
      { kind: "added", description: "Settings에서 본인 확인 후 비밀번호를 변경할 수 있습니다." },
      { kind: "added", description: "2단계 인증(TOTP)을 등록할 수 있습니다. Navigation > Settings > Account 탭에서 인증 앱을 연결해 계정 보안을 강화하세요. 등록하려면 이메일 인증을 먼저 마쳐야 합니다." },
      { kind: "added", description: "Console에서 Agent의 CPU/메모리 사용률을 실시간으로 모니터링할 수 있습니다." },
      { kind: "added", description: "연결된 Agent의 버전을 식별해 표시합니다. 버전을 보고하지 않는 Agent는 0.5.0 이전 빌드로 표시됩니다." },
      { kind: "added", description: "패치노트 페이지가 추가되었습니다. Navigation > Patch Notes 또는 Navigation 하단 버전을 클릭해 열 수 있습니다." },
    ],
  },
  {
    version: "0.4.0",
    codename: undefined,
    date: "2026-06-27",
    changes: [
      { kind: "added", description: "서비스에 서브도메인을 등록하고 포트별로 분기할 수 있습니다." },
      { kind: "changed", description: "서비스 모듈이 워크스페이스에서 분리되어 독립적으로 관리됩니다." },
      { kind: "fixed", description: "서비스 소스 URL이 길 때 저장되지 않던 문제를 고쳤습니다." },
    ],
  },
  {
    version: "0.3.0",
    codename: undefined,
    date: "2026-06-26",
    changes: [
      { kind: "added", description: "서브도메인 라우팅을 지원하는 리버스 터널이 추가되었습니다." },
      { kind: "added", description: "에이전트 상태와 메트릭을 실시간으로 확인할 수 있습니다." },
    ],
  },
];
