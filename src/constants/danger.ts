/**
 * 위험(파괴적) 동작의 시각 규격.
 *
 * 같은 "빨간 버튼"이 파일마다 제각각이었다. 채운 것, 테두리만 있는 것,
 * hover 에서 배경이 차오르는 것, raw Tailwind red-700 을 쓰는 것까지 섞여 있어
 * 사용자 입장에서는 위험도가 다른 버튼처럼 읽혔다.
 *
 * 강조 단계는 셋뿐이고, 색은 전부 --color-danger-color 하나에서 나온다.
 * - solid   : 되돌릴 수 없는 동작을 확정하는 자리. 화면당 하나가 원칙이다.
 * - outline : 위험하지만 아직 확정이 아닌 자리(확인 모달을 여는 버튼 등).
 * - soft    : 목록/카드 안에 섞여 있어 시선을 끌면 안 되는 자리.
 */

/** 모든 danger 버튼이 공유하는 형태. 색만 변형별로 덧붙인다. */
const base =
  "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-sm px-3.5 " +
  "text-xs font-semibold leading-none transition-colors cursor-pointer " +
  "disabled:cursor-not-allowed disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50";

/** 확정 실행. 채운 빨강 위 흰 글자. */
export const dangerSolidButtonClass = `${base} bg-danger-color text-white hover:bg-danger-color/85`;

/** 확인 절차로 넘어가는 버튼. 테두리만 두고 hover 에서 배경을 옅게 깐다. */
export const dangerOutlineButtonClass = `${base} border border-danger-color/40 text-danger-color hover:border-danger-color hover:bg-danger-color/10`;

/** 카드·목록 안의 낮은 강조. 크기는 호출부가 정하므로 색과 상태만 준다. */
export const dangerSoftButtonClass =
  "rounded-sm bg-danger-color/10 text-danger-color transition-colors cursor-pointer " +
  "hover:bg-danger-color/20 disabled:cursor-not-allowed disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50";

/** 아이콘 전용 버튼. 평소에는 보조 잉크로 두고 hover 에서만 위험을 드러낸다. */
export const dangerIconButtonClass =
  "flex shrink-0 rounded-sm p-1.5 text-secondary-text-color transition-colors cursor-pointer " +
  "hover:bg-danger-color/10 hover:text-danger-color " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50";

/** 경고·에러 박스. 본문 글자색은 호출부가 정한다(제목만 danger, 설명은 보조 잉크). */
export const dangerNoticeClass =
  "rounded-sm border border-danger-color/30 bg-danger-color/10 px-3 py-2.5";
