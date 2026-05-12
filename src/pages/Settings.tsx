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
          settingName="Logout"
          description="Log out from current account."
          type={SettingType.Button_Danger}
          onClick={logout}
        />
      </Section>
    </div>
  )
}
