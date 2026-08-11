import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";
import { passwordRules } from "../constants/validation";
import Field from "./ui/Field";
import Checklist from "./ui/Checklist";

type PasswordChangeModalProps = {
  onChanged: () => void;
};

type ApiResponse = { message?: string };

export default function PasswordChangeModal({ onChanged }: PasswordChangeModalProps) {
  const { closeModal, setCloseGuard } = useModal();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const isDirty = currentPassword !== "" || newPassword !== "" || newPasswordConfirm !== "";

  // 입력 중에 바깥을 눌러 닫으면 확인을 한 번 받는다.
  useEffect(() => {
    setCloseGuard(() => isDirty);
    return () => setCloseGuard(null);
  }, [isDirty, setCloseGuard]);

  // 기존 비밀번호와 같으면 바꾸는 의미가 없으므로 규칙에 포함한다.
  const newPasswordChecks = [
    ...passwordRules,
    { label: "기존 비밀번호와 다름", test: (v: string) => v !== "" && v !== currentPassword },
  ];

  const canSubmit =
    currentPassword !== "" &&
    newPasswordChecks.every(rule => rule.test(newPassword)) &&
    newPassword === newPasswordConfirm;

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    touch("currentPassword"); touch("newPassword"); touch("newPasswordConfirm");
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      // 기존 비밀번호 불일치도 401 이므로 자동 로그아웃 콜백은 전달하지 않는다.
      const res = await apiFetch("/v1/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirm }),
      });
      const body = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok) throw new Error(body.message ?? "비밀번호를 변경하지 못했습니다.");

      onChanged();
      closeModal({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-sm border border-border-color bg-modal-box-color p-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-service-color" />
        <div>
          <p className="text-sm font-semibold text-primary-text-color">비밀번호를 변경합니다</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary-text-color break-keep">
            본인 확인을 위해 기존 비밀번호를 함께 입력해 주세요.
          </p>
        </div>
      </div>

      <Field
        label="기존 비밀번호" type="password" value={currentPassword}
        onChange={v => { setCurrentPassword(v); touch("currentPassword"); }}
        placeholder="현재 사용 중인 비밀번호" autoFocus
      />

      <Field
        label="새 비밀번호" type="password" value={newPassword}
        onChange={v => { setNewPassword(v); touch("newPassword"); }}
        placeholder="새 비밀번호 입력"
      />
      {touched.newPassword && <Checklist rules={newPasswordChecks} value={newPassword} />}

      <Field
        label="새 비밀번호 확인" type="password" value={newPasswordConfirm}
        onChange={v => { setNewPasswordConfirm(v); touch("newPasswordConfirm"); }}
        placeholder="새 비밀번호 재입력"
      />
      {touched.newPasswordConfirm && (
        <Checklist
          rules={[{ label: "비밀번호 일치", test: (v: string) => v !== "" && v === newPassword }]}
          value={newPasswordConfirm}
        />
      )}

      {error && (
        <div className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={isSubmitting}
          className="cursor-pointer rounded-sm border border-border-color px-3.5 py-1.5 text-sm text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="flex cursor-pointer items-center gap-2 rounded-sm bg-service-color px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-button-progress-color disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          비밀번호 변경
        </button>
      </div>
    </form>
  );
}
