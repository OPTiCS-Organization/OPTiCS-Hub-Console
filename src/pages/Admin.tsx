import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/Auth.context";
import ReleaseList from "../components/release/ReleaseList";

/**
 * 관리자 패널.
 *
 * 권한 확인은 서버가 최종적으로 한다(PermissionGuard). 여기서 감추는 것은 화면 정리일 뿐,
 * 보안 경계가 아니다. 그래서 주소를 직접 열었을 때도 빈 화면 대신 이유를 보여 준다.
 */
export default function Admin() {
  const { user } = useAuth();

  if (user?.userPermission !== "administrator") {
    return (
      <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">
        <div className="flex items-start gap-2.5 rounded-sm border border-warning-color/30 bg-warning-color/10 px-3 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning-color mt-px" />
          <span className="text-warning-color text-xs leading-relaxed break-keep">
            이 페이지는 관리자만 사용할 수 있습니다.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-lg font-bold mb-1">Admin</h1>
        <p className="text-secondary-text-color text-sm break-keep">
          모든 워크스페이스에 함께 적용되는 설정입니다.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-1">Agent 릴리즈</h2>
        <p className="text-secondary-text-color text-xs break-keep mb-3">
          문제가 확인된 버전을 차단하면 모든 사용자가 그 버전으로 업데이트할 수 없게 되고,
          입력한 사유가 그대로 표시됩니다. 이미 그 버전을 사용 중인 OPTiCS Agent는 계속 동작합니다.
        </p>
        <ReleaseList />
      </section>
    </div>
  );
}
