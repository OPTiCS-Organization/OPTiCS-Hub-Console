/**
 * 입력 규칙. Checklist 컴포넌트가 그대로 받아 쓴다.
 *
 * 가입과 비밀번호 변경이 같은 규칙을 써야 하므로 여기 한 곳에만 둔다.
 * 화면마다 따로 정의하면 한쪽만 고쳐져 정책이 갈라진다.
 */

export interface ValidationRule {
  label: string;
  test: (value: string) => boolean;
}

export const emailRules: ValidationRule[] = [
  { label: "올바른 이메일 형식", test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
];

export const passwordRules: ValidationRule[] = [
  { label: "8자 이상", test: (v) => v.length >= 8 },
  { label: "영문으로 작성됨", test: (v) => /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/.test(v) },
  { label: "소문자 또는 대문자 포함", test: (v) => /[a-zA-Z]/.test(v) },
  { label: "특수문자 포함", test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v) },
];

export const displayNameRules: ValidationRule[] = [
  { label: "3자 이상", test: (v) => v.length >= 3 },
  { label: "-, _ 외 특수문자 사용 불가", test: (v) => /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$/.test(v) },
];
