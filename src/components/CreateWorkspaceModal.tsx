import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "../context/Workspace.context";
import { useModal } from "../context/Modal.context";
import { useAuth } from "../context/Auth.context";
import { apiFetch } from "../lib/apiFetch";
import { Loader2 } from "lucide-react";

const NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

type NameStatus = "idle" | "checking" | "valid" | "invalid";

export default function CreateWorkspaceModal() {
  const { createWorkspace } = useWorkspace();
  const { closeModal } = useModal();
  const { logout } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = name.trim();

  function getFormatError(value: string): string | null {
    if (value.length === 0) return null;
    if (value.length > 50) return "워크스페이스 이름의 길이는 50자 이내여야 합니다.";
    if (!NAME_REGEX.test(value)) return "워크스페이스 이름에는 알파벳, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.";
    return null;
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (name.length === 0) {
      setNameStatus("idle");
      setNameMessage(null);
      return;
    }

    const formatError = getFormatError(name);
    if (formatError) {
      setNameStatus("invalid");
      setNameMessage(formatError);
      return;
    }

    setNameStatus("checking");
    setNameMessage(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch("/v1/workspace/check-workspace-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceName: trimmed }),
        }, logout);

        if (!res.ok) {
          setNameStatus("idle");
          setNameMessage(null);
          return;
        }

        const json = await res.json() as { data: { valid: boolean } };
        if (json.data?.valid) {
          setNameStatus("valid");
          setNameMessage("이 워크스페이스 이름은 사용 가능합니다.");
        } else {
          setNameStatus("invalid");
          setNameMessage("이 워크스페이스 이름은 이미 사용 중입니다.");
        }
      } catch {
        setNameStatus("idle");
        setNameMessage(null);
      }
    }, 500);
  }, [name, trimmed, logout]);

  const isNameValid = nameStatus === "valid";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isNameValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await createWorkspace(trimmed);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "죄송합니다. 알 수 없는 에러가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const nameInputBorder =
    nameStatus === "valid" ? "border-green-500 focus:border-green-500" :
    nameStatus === "invalid" ? "border-red-500 focus:border-red-500" :
    "border-border-color focus:border-service-color";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-secondary-text-color font-medium uppercase tracking-widest">워크스페이스 이름 <span className="text-service-color">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex. production, my-workspace..."
          maxLength={50}
          autoFocus
          className={`w-full rounded-sm bg-modal-box-color border px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none transition-colors duration-100 ${nameInputBorder}`}
        />
        <div className="flex items-center justify-between">
          <span className={`text-[10px] ${nameStatus === "valid" ? "text-green-400" : nameStatus === "invalid" ? "text-red-400" : "text-secondary-text-color/0"}`}>
            {nameStatus === "checking"
              ? <span className="flex items-center gap-1 text-secondary-text-color"><Loader2 className="w-2.5 h-2.5 animate-spin inline" /> Checking...</span>
              : nameMessage ?? "　"}
          </span>
          <span className="text-[10px] text-secondary-text-color">{name.length} / 50</span>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-secondary-text-color font-medium uppercase tracking-widest">설명 <span className="text-secondary-text-color/50 normal-case tracking-normal font-normal">(Optional)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="이 워크스페이스에 대한 설명을 입력하세요..."
          maxLength={200}
          rows={3}
          className="w-full rounded-sm bg-modal-box-color border border-border-color px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors duration-100 resize-none"
        />
        <span className="text-[10px] text-secondary-text-color text-right">{description.length} / 200</span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-sm bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={closeModal}
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-sm text-sm text-secondary-text-color hover:text-primary-text-color border border-border-color hover:border-border-color/80 hover:bg-white/5 transition-colors duration-100 cursor-pointer disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isNameValid || isSubmitting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-sm font-semibold bg-service-color hover:bg-button-progress-color text-white transition-colors duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          생성
        </button>
      </div>
    </form>
  );
}
