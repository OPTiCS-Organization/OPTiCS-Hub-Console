import { Section } from "../components/ui/Section";
import { SettingOption, SettingType } from "../components/ui/SettingOption";
import { useAuth } from "../context/Auth.context";

export default function Settings() {
  const { logout } = useAuth();
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
