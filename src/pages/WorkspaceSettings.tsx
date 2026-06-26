import { useEffect, useState } from "react";
import { Section } from "../components/ui/Section";
import { SettingOption, SettingType } from "../components/ui/SettingOption";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import { useAuth } from "../context/Auth.context";
import type { Workspace } from "../context/Workspace.context";

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const RESERVED_WORKSPACE_SUBDOMAINS = new Set(["api", "docs", "console", "admin", "tunnel", "proxy"]);

function DeleteWorkspaceConfirmModal({ workspace, userDisplay }: { workspace: Workspace; userDisplay: string }) {
  const { deleteWorkspace } = useWorkspace();
  const { closeModal } = useModal();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = `${userDisplay}/${workspace.workspaceName}`;
  const canDelete = confirmation === expected && !isDeleting;

  async function handleDelete() {
    if (!canDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.workspaceIndex, confirmation);
      closeModal({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "워크스페이스 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border border-danger-color/30 bg-danger-color/10 px-3 py-2.5">
        <p className="text-sm font-semibold text-danger-color">이 작업은 되돌릴 수 없습니다.</p>
        <p className="mt-1 text-xs leading-relaxed text-secondary-text-color">
          워크스페이스와 연결 정보가 삭제되며, 활성화된 서브도메인의 DNS 레코드도 함께 삭제됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-secondary-text-color">
          삭제하려면 아래 문구를 그대로 입력하세요.
        </label>
        <div className="rounded-sm border border-border-color bg-background-color px-3 py-2 font-mono text-xs text-primary-text-color">
          {expected}
        </div>
        <input
          value={confirmation}
          onChange={e => {
            setConfirmation(e.target.value);
            setError(null);
          }}
          placeholder={expected}
          className="h-9 rounded-sm border border-border-color bg-modal-box-color px-3 text-sm text-primary-text-color outline-none transition-colors placeholder:text-secondary-text-color/40 focus:border-danger-color"
        />
      </div>

      {error && <p className="text-xs text-danger-color">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={isDeleting}
          className="h-8 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color disabled:opacity-50 cursor-pointer"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => { void handleDelete(); }}
          disabled={!canDelete}
          className="h-8 rounded-sm bg-danger-color px-3 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          {isDeleting ? "삭제 중" : "워크스페이스 삭제"}
        </button>
      </div>
    </div>
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
      "워크스페이스 삭제",
      <DeleteWorkspaceConfirmModal workspace={currentWorkspace} userDisplay={user.userDisplay} />,
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="text-primary-text-color mt-20">
        <h1 className="text-lg font-bold mb-1">Workspace Settings</h1>
        <p className="text-secondary-text-color text-sm">선택된 워크스페이스가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="text-primary-text-color mt-20">
      <h1 className="text-lg font-bold mb-1">Workspace Settings</h1>
      <p className="text-secondary-text-color text-sm">{currentWorkspace.workspaceName}</p>

      <Section sectionName="Subdomain">
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
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </Section>

      <Section sectionName="Danger">
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
  );
}
