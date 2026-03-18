import { createContext, useContext, useState, ReactNode } from "react";

interface ModalState {
  title: string;
  content: ReactNode;
}

interface ModalContextType {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const openModal = (title: string, content: ReactNode) => setModal({ title, content });
  const closeModal = () => setModal(null);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-lg mx-4 rounded-md border border-border-color bg-modal-background-color shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
              <span className="text-primary-text-color font-semibold text-sm">{modal.title}</span>
              <button
                onClick={closeModal}
                className="text-secondary-text-color hover:text-primary-text-color transition-colors duration-100 cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              {modal.content}
            </div>
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
