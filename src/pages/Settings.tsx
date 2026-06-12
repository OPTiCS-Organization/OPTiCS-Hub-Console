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
        <SettingOption
          settingName="Change password"
          description="Change to new password."
          type={SettingType.Button} 
        />
      </Section>
      <Section sectionName="Preferences">
        <SettingOption
          settingName="Dark Mode"
          description="Enable dark mode."
          type={SettingType.Toggle}
        />
      </Section>
      <Section sectionName="Notifications">
        <SettingOption
          settingName="On agent fail"
          description="Notify on agent get exception."
          type={SettingType.Toggle}
        />
        <SettingOption
          settingName="On agent disconnect"
          description="Notify on agent turns into offline."
          type={SettingType.Toggle}
        />
      </Section>
    </div>
  )
}
