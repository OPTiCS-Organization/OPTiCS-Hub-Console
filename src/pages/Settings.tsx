import { useCallback, useEffect, useState } from "react";
import { Section } from "../components/ui/Section";
import { SettingOption, SettingType } from "../components/ui/SettingOption";
import TwoFactorDisconnectModal from "../components/TwoFactorDisconnectModal";
import TwoFactorSetupModal from "../components/TwoFactorSetupModal";
import PasswordChangeModal from "../components/PasswordChangeModal";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";

type TwoFactorStatusResponse = {
  data?: {
    isTotpActive?: boolean;
    totpActivatedAt?: string | null;
  };
  message?: string;
};

export default function Settings() {
  const { logout, needsVerification } = useAuth();
  const { openModal } = useModal();
  const [isTotpActive, setIsTotpActive] = useState<boolean | null>(null);
  const [totpActivatedAt, setTotpActivatedAt] = useState<string | null>(null);
  const [isLoadingTotp, setIsLoadingTotp] = useState(true);
  const [totpStatusError, setTotpStatusError] = useState("");
  // 서버가 마지막 변경 시각을 내려주지 않으므로, 이번 세션에서 바꾼 경우에만 표시한다.
  const [passwordChangedAt, setPasswordChangedAt] = useState<Date | null>(null);

  const loadTwoFactorStatus = useCallback(async () => {
    setIsLoadingTotp(true);
    setTotpStatusError("");

    try {
      const res = await apiFetch("/v1/auth/2fa");
      const body = await res.json().catch(() => ({})) as TwoFactorStatusResponse;
      if (!res.ok) throw new Error(body.message ?? "2단계 인증 상태를 확인하지 못했습니다.");

      setIsTotpActive(body.data?.isTotpActive === true);
      setTotpActivatedAt(body.data?.totpActivatedAt ?? null);
    } catch (err) {
      setIsTotpActive(null);
      setTotpStatusError(err instanceof Error ? err.message : "2단계 인증 상태를 확인하지 못했습니다.");
    } finally {
      setIsLoadingTotp(false);
    }
  }, []);

  useEffect(() => {
    void loadTwoFactorStatus();
  }, [loadTwoFactorStatus]);

  function handlePasswordChange() {
    openModal(
      "비밀번호 변경",
      <PasswordChangeModal onChanged={() => setPasswordChangedAt(new Date())} />,
    );
  }

  function handleTwoFactorAction() {
    if (totpStatusError) {
      void loadTwoFactorStatus();
      return;
    }

    if (isTotpActive) {
      openModal(
        "2단계 인증 해제",
        <TwoFactorDisconnectModal
          onDisconnected={() => {
            setIsTotpActive(false);
            setTotpActivatedAt(null);
          }}
        />,
      );
      return;
    }

    openModal(
      "2단계 인증 등록",
      <TwoFactorSetupModal
        onEnabled={() => {
          setIsTotpActive(true);
          setTotpActivatedAt(new Date().toISOString());
        }}
      />,
    );
  }

  // 이미 등록된 계정은 인증 여부와 무관하게 해제할 수 있어야 하므로,
  // 미인증 안내는 "아직 등록하지 않은" 경우에만 노출한다.
  const blockedByVerification = needsVerification && !isTotpActive;

  const twoFactorDescription = totpStatusError
    ? totpStatusError
    : isTotpActive
      ? `활성화됨${totpActivatedAt ? ` · ${new Date(totpActivatedAt).toLocaleDateString("ko-KR")}` : ""}`
      : blockedByVerification
        ? "2단계 인증을 등록하려면 먼저 이메일 인증을 완료해야 합니다."
        : "인증 앱을 등록해 계정 보안을 강화합니다.";

  return (
    <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">
      <h1 className="text-lg font-bold mb-1">Settings</h1>
      <p className="text-secondary-text-color text-sm break-keep">계정 보안과 알림 환경을 관리합니다.</p>

      {/* 섹션 사이 간격은 페이지가 정한다. WorkspaceSettings 와 같은 리듬을 쓴다. */}
      <div className="mt-8 flex flex-col gap-8">
      <Section sectionName="Account">
        <SettingOption
          settingName="로그아웃"
          description="현재 계정에서 로그아웃 합니다."
          type={SettingType.Button_Danger}
          onClick={logout}
        />
        <SettingOption
          settingName="비밀번호 변경"
          description={passwordChangedAt
            ? `변경됨 · ${passwordChangedAt.toLocaleDateString("ko-KR")}`
            : "기존 비밀번호를 새 비밀번호로 변경합니다."}
          type={SettingType.Button}
          buttonLabel="변경"
          onClick={handlePasswordChange}
        />
        <SettingOption
          settingName="2단계 인증"
          description={twoFactorDescription}
          type={isTotpActive ? SettingType.Button_Danger : SettingType.Button}
          buttonLabel={isLoadingTotp ? "확인 중" : totpStatusError ? "다시 시도" : isTotpActive ? "해제" : "등록"}
          buttonLoading={isLoadingTotp}
          buttonDisabled={blockedByVerification}
          onClick={handleTwoFactorAction}
        />
      </Section>
      <Section sectionName="Preferences">
        <SettingOption
          settingName="다크 모드"
          description="다크 모드를 활성화합니다."
          type={SettingType.Toggle}
        />
      </Section>
      <Section sectionName="Notifications">
        <SettingOption
          settingName="서비스가 실패 했을 때"
          description="서비스에서 예외가 발생했을 때 알림을 전송합니다."
          type={SettingType.Toggle}
        />
        <SettingOption
          settingName="에이전트가 오프라인으로 변경될 때"
          description="에이전트가 오프라인으로 전환된 경우 알림을 전송합니다."
          type={SettingType.Toggle}
        />
      </Section>
      </div>
    </div>
  )
}
