import { useEffect, useState } from "react";
import { AlertTriangle, Globe, Trash2 } from "lucide-react";
import { Section } from "../components/ui/Section";
import { SettingOption, SettingType } from "../components/ui/SettingOption";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import { useAuth } from "../context/Auth.context";
import type { Workspace } from "../context/Workspace.context";
import { dangerNoticeClass } from "../constants/danger";
import ConfirmDialog from "../components/ui/ConfirmDialog";

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const RESERVED_WORKSPACE_SUBDOMAINS = new Set(["api", "docs", "console", "admin", "tunnel", "proxy"]);

function DeleteWorkspaceConfirmModal({ workspace, userDisplay }: { workspace: Workspace; userDisplay: string }) {
  const { deleteWorkspace } = useWorkspace();
  const { closeModal } = useModal();
  const [error, setError] = useState<string | null>(null);
  const expected = `${userDisplay}/${workspace.workspaceName}`;

  return (
    <ConfirmDialog
      tone="danger"
      target={{
        name: workspace.workspaceName,
        // 워크스페이스는 코드가 없어 카드가 한 줄로 비어 보인다. 함께 사라지는
        // 서브도메인을 붙이면 카드가 채워지면서 삭제 범위도 같이 읽힌다.
        detail: workspace.workspaceSubdomain ? `${workspace.workspaceSubdomain}.optics.run` : undefined,
        icon: <Trash2 className="h-4 w-4" />,
      }}
      impacts={[
        {
          emphasis: true,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          title: '워크스페이스와 연결 정보가 사라집니다',
          detail: '되돌릴 수 없습니다.',
        },
        {
          icon: <Globe className="h-3.5 w-3.5" />,
          title: '활성화된 서브도메인의 DNS 레코드도 함께 삭제됩니다',
        },
      ]}
      friction={{
        kind: 'phrase',
        phrase: expected,
        label: '삭제하려면 다음 문구를 그대로 입력하세요.',
      }}
      confirmLabel="워크스페이스 삭제"
      onCancel={() => closeModal()}
      onConfirm={async () => {
        setError(null);
        try {
          await deleteWorkspace(workspace.workspaceIndex, expected);
          closeModal({ force: true });
        } catch (err) {
          setError(err instanceof Error ? err.message : "워크스페이스 삭제에 실패했습니다.");
        }
      }}
    >
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-danger-color break-keep">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}

export default function WorkspaceSettings() {
  const { currentWorkspace, updateSubdomain, toggleSubdomain } = useWorkspace();
  const { openModal } = useModal();
  const { user } = useAuth();

  const subdomain = currentWorkspace?.workspaceSubdomain ?? null;
  const active = currentWorkspace?.workspaceSubdomainActive ?? false;

  const [input, setInput] = useState(subdomain ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 현재 워크스페이스가 바뀌면 입력값 동기화
  useEffect(() => {
    setInput(subdomain ?? "");
    setError(null);
  }, [currentWorkspace?.workspaceIndex, subdomain]);

  const trimmed = input.trim();
  const formatError =
    trimmed !== "" && RESERVED_WORKSPACE_SUBDOMAINS.has(trimmed)
      ? "예약된 서브도메인입니다."
      : trimmed !== "" && (trimmed.length > 63 || !SUBDOMAIN_REGEX.test(trimmed))
      ? "서브도메인은 소문자/숫자/하이픈(-)만 사용할 수 있습니다."
      : null;
  const isDirty = trimmed !== (subdomain ?? "");
  const canToggle = !!subdomain && !isDirty && !formatError && !isSaving;
  const subdomainUrl = subdomain ? `*.${subdomain}.optics.run` : null;
  const inputDescription = formatError
    ? formatError
    : subdomainUrl
      ? `현재 워크스페이스 주소는 ${subdomainUrl} 입니다.`
      : "외부 접속에 사용할 워크스페이스 서브도메인을 등록합니다.";
  const toggleDescription = subdomain
    ? isDirty
      ? "변경사항을 저장한 뒤 활성화 상태를 변경할 수 있습니다."
      : active
        ? "현재 외부에서 접근할 수 있습니다."
        : "비활성화되어 외부에서 접근할 수 없습니다."
    : "서브도메인을 먼저 저장해야 활성화할 수 있습니다.";

  async function handleSave() {
    if (!currentWorkspace || formatError || !isDirty || isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await updateSubdomain(currentWorkspace.workspaceIndex, trimmed === "" ? null : trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "서브도메인 변경에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(next: boolean) {
    if (!currentWorkspace || !canToggle || isToggling) return;
    setError(null);
    setIsToggling(true);
    try {
      await toggleSubdomain(currentWorkspace.workspaceIndex, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "서브도메인 상태 변경에 실패했습니다.");
    } finally {
      setIsToggling(false);
    }
  }

  function handleOpenDeleteModal() {
    if (!currentWorkspace || !user?.userDisplay) return;
    openModal(
      "워크스페이스 삭제 확인",
      <DeleteWorkspaceConfirmModal workspace={currentWorkspace} userDisplay={user.userDisplay} />,
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">
        <h1 className="text-lg font-bold mb-1">Workspace Settings</h1>
        <p className="text-secondary-text-color text-sm">선택된 워크스페이스가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">
      <h1 className="text-lg font-bold mb-1">Workspace Settings</h1>
      <p className="text-secondary-text-color text-sm break-keep wrap-break-word">{currentWorkspace.workspaceName}</p>

      {/* 섹션 사이 간격은 페이지가 정한다. Section 이 자기 바깥 여백(mt-8)을 들고 있으면
          페이지마다 다른 리듬을 주고 싶을 때 손댈 곳이 없어진다. */}
      <div className="mt-8 flex flex-col gap-8">

      <Section
        sectionName="Subdomain"
        notice={error && (
          <p role="alert" className={`${dangerNoticeClass} text-xs text-danger-color break-keep`}>
            {error}
          </p>
        )}
      >
        <SettingOption
          settingName="서브도메인"
          description={inputDescription}
          type={SettingType.Input}
          inputValue={input}
          onInputChange={value => {
            setInput(value.toLowerCase());
            setError(null);
          }}
          inputPlaceholder="my-team"
          inputSuffix=".optics.run"
          maxLength={63}
          buttonLabel={isSaving ? "저장 중" : "변경"}
          onClick={handleSave}
          buttonDisabled={!!formatError || !isDirty || isSaving}
        />
        <SettingOption
          settingName="서브도메인 활성화"
          description={toggleDescription}
          type={SettingType.Toggle}
          value={active}
          onChange={handleToggle}
          toggleDisabled={!canToggle || isToggling}
        />
      </Section>

      {/* 워크스페이스 삭제는 되돌릴 수 없는 작업이므로 나머지 설정과 같은 카드에 두지 않고
          별도 Section으로 분리한다. tone="danger"로 테두리/헤더도 위험 톤으로 바꿔
          시각적으로도 한 번 더 구분된다. */}
      <Section
        sectionName="Danger"
        tone="danger"
        notice={(
          <div className={`flex items-start gap-2.5 ${dangerNoticeClass}`}>
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger-color mt-px" />
            <span className="text-danger-color text-xs leading-relaxed break-keep">
              아래 작업은 되돌릴 수 없습니다. 워크스페이스와 연결된 모든 설정이 영구히 삭제됩니다.
            </span>
          </div>
        )}
      >
        <SettingOption
          settingName="워크스페이스 삭제"
          description="워크스페이스와 연결된 설정을 삭제합니다."
          type={SettingType.Button_Danger}
          buttonLabel="삭제"
          onClick={handleOpenDeleteModal}
          buttonDisabled={!user?.userDisplay}
        />
      </Section>
      </div>
    </div>
  );
}
