import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ModalState {
  title: string;
  content: ReactNode;
}

interface ModalContextType {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: (options?: { force?: boolean }) => void;
  setCloseGuard: (guard: (() => boolean) | null) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [closeGuard, setCloseGuard] = useState<(() => boolean) | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const openModal = useCallback((title: string, content: ReactNode) => {
    setCloseGuard(null);
    setConfirmingClose(false);
    setModal({ title, content });
  }, []);
  const updateCloseGuard = useCallback((guard: (() => boolean) | null) => {
    setCloseGuard(() => guard);
  }, []);
  const closeModal = useCallback((options?: { force?: boolean }) => {
    if (!options?.force && closeGuard?.()) {
      setConfirmingClose(true);
      return;
    }
    setConfirmingClose(false);
    setCloseGuard(null);
    setModal(null);
  }, [closeGuard]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, setCloseGuard: updateCloseGuard }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => closeModal()}
        >
          <div
            className="relative mx-4 max-h-[88vh] w-full max-w-xl overflow-hidden rounded-md border border-border-color bg-modal-background-color shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
              <span className="text-primary-text-color font-semibold text-sm">{modal.title}</span>
              <button
                onClick={() => closeModal()}
                className="text-secondary-text-color hover:text-primary-text-color transition-colors duration-100 cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[calc(88vh-49px)] overflow-y-auto px-4 py-3.5">
              {modal.content}
            </div>

            {confirmingClose && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-md border border-border-color bg-modal-background-color p-4 shadow-2xl">
                  <p className="text-sm font-semibold text-primary-text-color">정말로 닫으시겠습니까?</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-secondary-text-color">
                    입력한 내용이 저장되지 않고 사라집니다.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingClose(false)}
                      className="h-8 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color cursor-pointer"
                    >
                      계속 작성
                    </button>
                    <button
                      type="button"
                      onClick={() => closeModal({ force: true })}
                      className="h-8 rounded-sm bg-danger-color px-3 text-xs font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}
