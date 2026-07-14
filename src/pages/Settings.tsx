import { useCallback, useEffect, useState } from "react";
import { Section } from "../components/ui/Section";
import { SettingOption, SettingType } from "../components/ui/SettingOption";
import TwoFactorDisconnectModal from "../components/TwoFactorDisconnectModal";
import TwoFactorSetupModal from "../components/TwoFactorSetupModal";
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
  const { logout } = useAuth();
  const { openModal } = useModal();
  const [isTotpActive, setIsTotpActive] = useState<boolean | null>(null);
  const [totpActivatedAt, setTotpActivatedAt] = useState<string | null>(null);
  const [isLoadingTotp, setIsLoadingTotp] = useState(true);
  const [totpStatusError, setTotpStatusError] = useState("");

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

  const twoFactorDescription = totpStatusError
    ? totpStatusError
    : isTotpActive
      ? `활성화됨${totpActivatedAt ? ` · ${new Date(totpActivatedAt).toLocaleDateString("ko-KR")}` : ""}`
      : "인증 앱을 등록해 계정 보안을 강화합니다.";

  return (
    <div className="text-primary-text-color mt-20">
      <h1 className="text-lg font-bold mb-1">Settings</h1>
      <Section sectionName="Account">
        <SettingOption
          settingName="로그아웃"
          description="현재 계정에서 로그아웃 합니다."
          type={SettingType.Button_Danger}
          onClick={logout}
        />
        <SettingOption
          settingName="비밀번호 변경"
          description="기존 비밀번호를 새 비밀번호로 변경합니다."
          type={SettingType.Button} 
        />
        <SettingOption
          settingName="2단계 인증"
          description={twoFactorDescription}
          type={isTotpActive ? SettingType.Button_Danger : SettingType.Button}
          buttonLabel={isLoadingTotp ? "확인 중..." : totpStatusError ? "다시 시도" : isTotpActive ? "해제" : "등록"}
          buttonDisabled={isLoadingTotp}
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
  )
}
