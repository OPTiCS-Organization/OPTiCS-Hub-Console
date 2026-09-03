/**
 * 패치노트. 릴리스와 함께 배포되므로 별도 API 없이 이 파일만 수정한다.
 *
 * 새 항목은 배열 맨 앞에 추가한다. 맨 앞 항목의 version 이 곧 현재 버전(currentVersion)이며
 * 화면에 표시되는 버전도 여기서 나온다. package.json 을 따로 맞출 필요는 없다.
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
  /**
   * 경고를 해소하기 위해 사용자가 호스트에서 실행해야 하는 명령.
   *
   * 설명 문장 안에 섞으면 어디까지가 명령인지 알 수 없어 그대로 붙여넣지 못한다.
   * 복사 가능한 블록으로 따로 낸다. warning 없이 단독으로 쓰지 않는다.
   */
  warningCommand?: string;
  /** 컴포넌트별 버전 변경 표. Hub 외 Agent/Installer 등도 함께 릴리스될 때만 채운다. */
  versions?: ComponentVersionChange[];
  /**
   * beta: 아직 실험적인 기능. 목록에서 BETA 배지가 붙는다.
   * partialFix: 증상은 눌렀지만 원인을 끝까지 못 짚었거나 재발 여지가 남은 항목.
   *             "고쳤다"고 단정하면 사용자가 재발을 보고하지 않게 되므로 따로 표시한다.
   */
  changes: { kind: ChangeKind; description: string; beta?: boolean; partialFix?: boolean }[];
}

/**
 * 배지 공통 형태. 색만 변형별로 덧붙인다.
 *
 * 한 페이지에 CURRENT / IMPORTANT / BETA / PARTIAL FIX 네 종류가 함께 놓이는데,
 * 예전에는 앞 둘이 맨 텍스트, 뒤 둘만 알약 모양이라 같은 위계로 읽히지 않았다.
 * 형태를 하나로 묶고 위계는 채움 여부로만 가른다.
 * - 릴리스 전체에 붙는 배지(CURRENT, IMPORTANT): 배경을 채워 먼저 눈에 걸리게 한다.
 * - 개별 항목에 붙는 배지(BETA, PARTIAL FIX): 테두리만 둬서 본문을 덮지 않게 한다.
 */
export const badgeBaseClass =
  "inline-block shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 " +
  "text-4xs font-semibold uppercase leading-none tracking-wider";

/** 지금 실행 중인 버전. */
export const currentBadgeClass = "border-service-color/40 bg-service-color/10 text-service-color";

/** 업그레이드 전 반드시 읽어야 하는 릴리스. */
export const importantBadgeClass = "border-warning-color/40 bg-warning-color/10 text-warning-color";

/** 아직 실험적인 기능. */
export const betaBadgeClass = "border-warning-color/40 text-warning-color";

/**
 * 완전한 수정이 아닌 항목. BETA와 같은 테두리 형태를 쓰되 색으로 구분한다.
 * "MONITORING" 은 지켜본다는 사실만 알릴 뿐 수정이 덜 됐다는 뜻이 안 읽혀서 쓰지 않는다.
 */
export const partialFixBadgeClass = "border-caution-color/40 text-caution-color";

/** 배지가 좁아 다 담지 못하는 뜻을 툴팁으로 풀어 준다. */
export const partialFixBadgeHint = "완전한 수정이 아닙니다. 재발 여부를 모니터링 중이며, 패치 이후에도 동일 증상이 재현될 수 있습니다.";

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
    version: "0.7.2",
    codename: undefined,
    date: "2026-09-04",
    highlight: true,
    versions: [
      { scope: "OPTiCS Hub", from: "0.7.1", to: "0.7.2" },
      { scope: "OPTiCS Landing", from: "0.0.0", to: "0.1.0" },
    ],
    changes: [
      { kind: 'added', description: "랜딩페이지가 추가되었습니다." },
      { kind: 'added', description: "랜딩페이지에서 필요한 공개 API를 추가했습니다." },
    ]
  },
  {
    version: "0.7.1",
    codename: undefined,
    date: "2026-09-02",
    highlight: true,
    warning: "0.7.0 이하에서 OPTiCS Console의 원격 업데이트를 한 번이라도 사용한 OPTiCS Agent는 이 버전을 원격으로 설치할 수 없습니다. 아래 명령을 Agent 호스트에서 실행해 주세요. Console의 Web SSH 터미널에서도 실행할 수 있습니다. 이번 한 번만 수동 업데이트가 필요하며, 이후에는 원격 업데이트가 정상 동작합니다. (설치 경로를 바꿨다면 첫 줄을 그 경로로 바꿔 주세요.)",
    warningCommand: [
      "cd ~/.local/share/optics/agent",
      "sed -i '/^AGENT_IMAGE_TAG=/d' .env",
      "echo 'AGENT_IMAGE_TAG=0.7.1' >> .env",
      "docker compose pull && docker compose up -d",
    ].join("\n"),
    versions: [
      { scope: "OPTiCS Agent", from: "0.7.0", to: "0.7.1" },
    ],
    changes: [
      { kind: 'added', beta: true, description: "OPTiCS Console에서 업데이트할 OPTiCS Agent 버전을 직접 고를 수 있습니다. 베타 릴리즈를 미리 사용해 보거나 특정 버전으로 맞출 때 사용하세요." },
      { kind: 'added', description: "문제가 확인된 OPTiCS Agent 버전은 목록에 이유와 함께 표시되며 업데이트 대상으로 선택할 수 없습니다." },
      { kind: 'added', description: "패치노트의 주의 사항에 필요한 명령이 함께 표시되며, 복사해 바로 사용할 수 있습니다." },
      { kind: 'fixed', beta: true, description: "원격 업데이트를 한 번 사용한 뒤로는 다시 사용할 수 없던 문제를 수정했습니다." },
      { kind: 'fixed', description: "OPTiCS Agent Dashboard가 실행 중이 아닐 때 원격 업데이트가 실패하던 문제를 수정했습니다." },
      { kind: 'changed', description: "업데이트를 시작할 수 없는 상태에서는 아무것도 변경하지 않고 중단합니다. 실행 중인 OPTiCS Agent와 서비스는 영향을 받지 않습니다." },
      { kind: 'changed', description: "업데이트에 실패해 이전 버전으로 되돌린 경우, 되돌리기가 실제로 완료됐는지 확인한 결과를 알려줍니다." },
    ]
  },
  {
    version: "0.7.0",
    codename: "Doppler",
    date: "2026-09-01",
    versions: [
      { scope: "OPTiCS Hub", from: "0.6.1", to: "0.7.0" },
      { scope: "OPTiCS Console", from: "0.6.1", to: "0.7.0" },
      { scope: "OPTiCS Agent", from: "0.6.1", to: "0.7.0" },
    ],
    changes: [
      { kind: 'changed', beta: true, description: "OPTiCS Agent가 OPTiCS Gateway에 연결 풀을 생성해두도록 변경해 서비스 레이턴시를 소폭 개선했습니다." },
      { kind: 'fixed', description: "OPTiCS Agent 내부에서 일부 구성 요소가 중복으로 생성되어 서비스 상태와 알림이 서로 어긋날 수 있던 문제를 수정했습니다." },
    ]
  },
  {
    version: "0.6.1",
    codename: undefined,
    date: "2026-08-28",
    versions: [
      { scope: "OPTiCS Hub", from: "0.6.0", to: "0.6.1" },
      { scope: "OPTiCS Console", from: "0.6.0", to: "0.6.1" },
      { scope: "OPTiCS Agent", from: "0.6.0", to: "0.6.1" },
    ],
    changes: [
      { kind: 'fixed', description: "OPTiCS Gateway가 기동하지 못해 모든 서비스 주소가 응답하지 않던 문제를 수정했습니다." },
      { kind: 'fixed', description: "OPTiCS Hub가 연결된 OPTiCS Agent를 찾지 못해 서비스 접속 요청이 실패하던 문제를 수정했습니다." },
      { kind: 'fixed', description: "OPTiCS Agent가 자신의 버전을 보고하지 못해 OPTiCS Console에서 버전이 비어 보이고 원격 업데이트를 사용할 수 없던 문제를 수정했습니다." },
      { kind: 'fixed', description: "OPTiCS Console을 한동안 열어두었다가 다시 사용할 때 로그인이 임의로 풀리던 문제를 수정했습니다." },
      { kind: 'changed', description: "OPTiCS Console의 Agent 목록에서 업데이트 알림이 카드를 가득 채우던 것을 작은 배지로 줄였습니다." },
      { kind: 'changed', description: "OPTiCS Console의 Settings에서 2단계 인증 상태를 확인하는 동안 진행 표시가 나타나도록 개선했습니다." },
    ]
  },
  {
    version: "0.6.0",
    codename: "Asterism",
    date: "2026-08-28",
    highlight: true,
    warning: "이 업데이트를 적용하려면 OPTiCS Agent 0.6.0 수동 업데이트가 필요합니다. 0.6.0 미만 버전의 Agent는 더 이상 OPTiCS Hub에 연결되지 않으며, 연결된 서비스도 함께 중단됩니다.",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.5", to: "0.6.0" },
      { scope: "OPTiCS Console", from: "0.5.5", to: "0.6.0" },
      { scope: "OPTiCS Agent", from: "0.5.3", to: "0.6.0" },
      { scope: "OPTiCS Linux Installer (Arch/Ubuntu)", from: "0.3.3", to: "0.4.0" },
      { scope: "OPTiCS Windows Installer (10/11)", from: "0.2.0", to: "0.4.0" },
    ],
    changes: [
      { kind: 'added', beta: true, description: "OPTiCS Console에서 OPTiCS Agent를 원격으로 업데이트하는 기능을 추가했습니다." },
      { kind: 'added', description: "OPTiCS Console의 사이드바를 아이콘만 남기고 접을 수 있도록 개선했습니다. 접은 상태는 다음 접속에도 유지됩니다." },
      { kind: 'added', description: "OPTiCS Console 사이드바 하단에 계정 메뉴를 추가해 프로필과 로그아웃에 바로 접근할 수 있도록 했습니다." },
      { kind: 'changed', description: "OPTiCS Console 사이드바에서 현재 보고 있는 메뉴가 더 뚜렷하게 드러나도록 강조 방식을 개선했습니다." },
      { kind: 'changed', description: "OPTiCS Console 사이드바의 메인 메뉴와 워크스페이스 메뉴 전환에 이동 방향이 드러나는 전환 효과를 적용했습니다." },
      { kind: 'changed', description: "OPTiCS Console의 본문 여백을 화면 폭에 맞춰 재조정해 넓은 화면에서 내용이 한쪽으로 쏠려 보이던 점을 개선했습니다." },
      { kind: 'changed', description: "OPTiCS Console에서 키보드로 이동할 때 현재 선택된 항목이 표시되도록 개선했습니다." },
      { kind: 'changed', description: "OPTiCS Gateway의 라우팅 오류 피드백 페이지에서 더 상세한 정보를 제공하도록 개선했습니다." },
      { kind: 'changed', description: "OPTiCS Agent 및 OPTiCS Gateway의 터널링 로직을 수정해 서비스 요청 지연시간을 소폭 단축했습니다." },
      { kind: 'changed', description: "OPTiCS Hub가 지원하지 않는 프로토콜 버전의 OPTiCS Agent 연결을 거부합니다." },
      { kind: 'fixed', partialFix: true, description: "OPTiCS Agent에서 반환하는 응답이 매우 길 경우 응답 본문이 잘리던 문제를 수정했습니다." },
      { kind: 'security', description: "OPTiCS Agent와 OPTiCS Hub가 주고받는 모든 통신에 서명 검증을 도입했습니다." },
    ]
  },
  {
    version: "0.5.5",
    codename: undefined,
    date: "2026-08-21",
    versions: [
      { scope: "OPTiCS Hub", from: "0.5.4", to: "0.5.5" },
      { scope: "OPTiCS Console", from: "0.5.4", to: "0.5.5" },
    ],
    changes: [
      { kind: 'added', description: "OPTiCS Gateway에서 서비스 라우팅 실패 시 실패 원인 피드백 기능을 추가했습니다." },
      { kind: 'added', description: "OPTiCS Console의 일부 버튼에 해당 버튼의 기능을 설명하는 UI를 추가했습니다." },
    ]
  },
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

/**
 * 화면에 표시하는 현재 버전.
 *
 * package.json을 참조하면 릴리스마다 두 곳을 맞춰야 하고, 한쪽만 올라가면
 * "Current" 배지가 어느 항목에도 붙지 않은 채 아무도 눈치채지 못한다.
 * 목록 맨 앞 항목을 유일한 출처로 두어 패치노트를 추가하는 것만으로 버전이 따라오게 한다.
 */
export const currentVersion = patchNotes[0]?.version ?? "";
