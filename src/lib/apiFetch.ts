const API_URL = import.meta.env.VITE_API_URL as string;

type OnForceLogout = () => void;

/**
 * credentials: "include" 기본 적용 fetch 래퍼.
 * - A0F5 (토큰 갱신 완료): 동일 요청 1회 재시도
 * - A0F4 (리프레시 토큰 만료): onForceLogout 호출
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  onForceLogout?: OnForceLogout,
): Promise<Response> {
  const url = `${API_URL}${path}`;
  const options: RequestInit = { ...init, credentials: "include" };

  const res = await fetch(url, options);

  // 200 OK 이지만 A0F5 = 토큰 갱신됨 → 재시도
  if (res.ok) {
    const cloned = res.clone();
    try {
      const body = await cloned.json() as { code?: string };
      if (body.code === "A0F5") {
        return fetch(url, options);
      }
    } catch {
      // JSON이 아닌 응답은 그대로 반환
    }
  }

  // 401 = A0F4 (리프레시 토큰 만료) → 강제 로그아웃
  if (res.status === 401) {
    onForceLogout?.();
  }

  return res;
}
