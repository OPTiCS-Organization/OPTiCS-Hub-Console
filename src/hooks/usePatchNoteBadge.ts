import { useSyncExternalStore } from "react";
import { patchNotes } from "../constants/patchNotes";

/** 사용자가 마지막으로 확인한 패치노트 버전. */
const STORAGE_KEY = "seenPatchNoteVersion";

/**
 * 기록이 없는 사용자가 "여기까지는 본 것"으로 간주할 버전.
 *
 * 최신 버전으로 시드하면 이 기능이 배포되는 릴리스에서는 아무도 알림을 못 본다.
 * 한 단계 이전으로 두어 첫 진입 때 최신 릴리스 하나가 강조되게 한다.
 */
const FALLBACK_SEEN_VERSION = "0.5.2";

/** patchNotes는 최신 항목이 배열 맨 앞이다. */
function latestVersion(): string {
  return patchNotes[0]?.version ?? "";
}

// localStorage는 시크릿 모드나 쿠키 차단 설정에서 접근만 해도 예외를 던진다.
// 알림 배지 하나 때문에 화면 전체가 죽으면 안 되므로 실패는 조용히 흘린다.
function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* 저장이 안 되는 환경에서는 배지가 계속 보일 뿐 나머지 동작은 그대로다. */
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 다른 탭에서 패치노트를 열면 이 탭의 배지도 함께 사라져야 한다.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * 아직 확인하지 않은 패치노트 수.
 *
 * 저장된 버전이 목록에 없으면(목록에서 밀려난 옛 버전이거나 값이 깨진 경우)
 * 개수를 셀 수 없으므로 -1을 돌려준다. 호출부는 숫자 대신 점만 찍는다.
 */
function unreadCount(): number {
  const seen = readSeenVersion();
  if (seen === null || seen === latestVersion()) return 0;

  const index = patchNotes.findIndex(note => note.version === seen);
  return index === -1 ? -1 : index;
}

// 기록이 없으면 기준점을 하나 심어 둔다. 이게 없으면 안 읽은 개수를 셀 수 없다.
if (readSeenVersion() === null) writeSeenVersion(FALLBACK_SEEN_VERSION);

/** 확인하지 않은 패치노트 수를 구독한다. 0이면 배지를 띄우지 않는다. */
export function useUnreadPatchNoteCount(): number {
  return useSyncExternalStore(subscribe, unreadCount, () => 0);
}

/** 패치노트를 열었을 때 호출한다. 기록을 최신으로 올리고 구독 중인 화면에 알린다. */
export function markPatchNotesSeen(): void {
  if (readSeenVersion() === latestVersion()) return;
  writeSeenVersion(latestVersion());
  listeners.forEach(listener => listener());
}
