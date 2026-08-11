import { ResendCooldownError } from "../context/Auth.context";

const API_URL = import.meta.env.VITE_API_URL as string;

/** 코드가 유효하지 않은 이유. 서버가 구분해 주므로 화면 문구도 나눠서 보여준다. */
export type InvalidReason = "not_found" | "consumed" | "expired";

export type VerificationCheck =
  | { valid: true; email: string }
  | { valid: false; reason: InvalidReason };

async function post(path: string, body?: unknown) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({})) as { message?: string; retryAfterSeconds?: number };

  if (res.status === 429 && typeof body.retryAfterSeconds === "number") {
    throw new ResendCooldownError(body.retryAfterSeconds);
  }

  throw new Error(body.message ?? fallback);
}

/** 가입하려는 주소로 인증 메일을 보낸다. 쿨다운 중이면 ResendCooldownError 를 던진다. */
export async function sendVerificationEmail(email: string) {
  const res = await post("/v1/auth/verify", { email });
  if (!res.ok) await throwApiError(res, "인증 메일 발송에 실패했습니다.");
}

/**
 * 메일 링크의 코드가 아직 쓸 수 있는지 확인한다.
 * 만료·오타는 정상적인 흐름이라 서버가 에러가 아닌 결과로 돌려준다.
 */
export async function checkVerificationCode(verificationCode: string): Promise<VerificationCheck> {
  const res = await post("/v1/auth/verify/check", { verificationCode });

  if (!res.ok) await throwApiError(res, "인증 코드 확인에 실패했습니다.");

  const body = await res.json() as { data?: VerificationCheck };
  return body.data ?? { valid: false, reason: "not_found" };
}

/** 기존 사용자가 메일로 받은 코드로 인증을 완료한다. */
export async function confirmExistingVerification(verificationCode: string): Promise<{ email: string }> {
  const res = await post("/v1/auth/verify/confirm", { verificationCode });

  if (!res.ok) await throwApiError(res, "이메일 인증에 실패했습니다.");

  const body = await res.json() as { data?: { email: string } };
  return body.data ?? { email: "" };
}

/** 코드가 유효하지 않을 때 사용자에게 보여줄 문구. */
export const invalidReasonMessage: Record<InvalidReason, string> = {
  not_found: "잘못된 인증 링크입니다. 메일의 주소를 다시 확인해 주세요.",
  consumed: "이미 사용된 인증 링크입니다.",
  expired: "인증 링크가 만료되었습니다. 아래에서 다시 요청해 주세요.",
};
