const API_URL = import.meta.env.VITE_API_URL as string;

type OnForceLogout = () => void;

/** 토큰이 갱신되었으니 같은 요청을 다시 보내라는 신호. HTTP는 200으로 온다. */
const CODE_RETRY = "A0F5";

/**
 * 갱신이 필요한 응답인지 본문을 열어 확인해야 하는 크기 한계.
 *
 * `code`는 본문 안에 있어서 확인하려면 본문을 읽어야 하는데, 모든 2xx 응답에
 * 그렇게 하면 서비스 로그처럼 큰 응답까지 전부 메모리에 복사된다.
 * 갱신 신호는 본문이 작은 JSON이므로, 큰 응답은 애초에 열어보지 않는다.
 */
const MAX_PEEK_BYTES = 1024;

/**
 * 갱신이 막 일어난 직후를 나타내는 프라미스.
 *
 * 여기서 막을 수 있는 것과 없는 것을 구분해 둔다.
 *
 * 막을 수 없는 것: 액세스 토큰이 만료된 순간 **이미 동시에 나간** 요청들.
 * A0F5는 서버에서 갱신이 끝난 **뒤에** 도착하므로, 그 시점에 다른 요청들은
 * 이미 서버에 도달해 각자 갱신을 시도한 뒤다. 클라이언트가 개입할 지점이 없다.
 * 이 경쟁은 Hub의 회전 유예 창(jwt.util.ts의 REFRESH_ROTATION_GRACE_MS)이 받는다.
 *
 * 막을 수 있는 것: 갱신 직후에 **새로 시작하는** 요청들. 이들이 낡은 쿠키로 나가면
 * 또 갱신을 부르고, 그 갱신이 방금 발급된 토큰을 다시 회전시켜 유예 창을 헛되이 쓴다.
 * 재시도가 끝날 때까지 잠깐 붙잡아 두면 그 연쇄가 사라진다.
 */
let refreshSettled: Promise<void> | null = null;

/** 본문을 읽지 않고 넘길 응답인지. */
function tooLargeToPeek(response: Response): boolean {
  const length = response.headers.get("content-length");
  return length !== null && Number(length) > MAX_PEEK_BYTES;
}

/** 응답이 "다시 요청하라"는 갱신 신호인지 확인한다. 본문은 복제본으로만 읽는다. */
async function isRetrySignal(response: Response): Promise<boolean> {
  if (!response.ok || tooLargeToPeek(response)) return false;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return false;

  try {
    const body = await response.clone().json() as { code?: string };
    return body.code === CODE_RETRY;
  } catch {
    // JSON이 아니거나 본문이 비어 있으면 갱신 신호가 아니다.
    return false;
  }
}

/**
 * credentials: "include" 기본 적용 fetch 래퍼.
 *
 * - 갱신 신호(A0F5)를 받으면 같은 요청을 1회 재시도한다.
 * - 갱신 직후 새로 시작하는 요청은 재시도가 끝날 때까지 기다린다.
 * - 401(A0F4, 리프레시 토큰 만료)이면 onForceLogout을 호출한다.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  onForceLogout?: OnForceLogout,
): Promise<Response> {
  const url = `${API_URL}${path}`;
  const options: RequestInit = { ...init, credentials: "include" };

  // 갱신이 막 진행 중이면 끝난 뒤에 보낸다. 낡은 쿠키로 나가 갱신을 또 부르지 않도록.
  if (refreshSettled) await refreshSettled;

  const response = await fetch(url, options);

  if (!(await isRetrySignal(response))) {
    // 401 = A0F4 (리프레시 토큰 만료) → 강제 로그아웃
    if (response.status === 401) onForceLogout?.();
    return response;
  }

  /**
   * 갱신 신호를 받았다. 재시도가 끝날 때까지 뒤따르는 요청들을 붙잡아 둔다.
   *
   * 이미 다른 요청이 재시도 중이면 그 프라미스를 기다렸다가 바로 재시도한다.
   * 갱신은 서버에서 이미 끝났으므로 여기서 할 일은 순서를 맞추는 것뿐이다.
   */
  if (refreshSettled) {
    await refreshSettled;
    const retried = await fetch(url, options);
    if (retried.status === 401) onForceLogout?.();
    return retried;
  }

  let release!: () => void;
  refreshSettled = new Promise<void>(resolve => { release = resolve; });

  try {
    const retried = await fetch(url, options);

    // 재시도가 401이면 갱신 이후에도 세션이 살아나지 못한 것이다.
    // 예전에는 재시도 응답을 그대로 돌려주기만 해서, 세션이 죽었는데도 로그인 화면으로 가지 못했다.
    if (retried.status === 401) onForceLogout?.();
    return retried;
  } finally {
    // 재시도가 실패로 끝나더라도 대기 중인 요청들을 영원히 붙잡아 두면 안 된다.
    refreshSettled = null;
    release();
  }
}
