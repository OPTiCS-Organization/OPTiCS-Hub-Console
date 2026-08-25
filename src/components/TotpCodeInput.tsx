import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

type TotpCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function TotpCodeInput({ value, onChange, disabled = false, autoFocus = true }: TotpCodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, inputValue: string) {
    const digits = inputValue.replace(/\D/g, "");
    const next = value.padEnd(6, " ").split("");

    if (!digits) {
      next[index] = " ";
      onChange(next.join("").trimEnd());
      return;
    }

    digits.slice(0, 6 - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    onChange(next.join("").trimEnd());
    inputRefs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = value.padEnd(6, " ").split("");
      if (next[index] !== " ") {
        next[index] = " ";
        onChange(next.join("").trimEnd());
        if (index > 0) inputRefs.current[index - 1]?.focus();
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedCode) return;
    event.preventDefault();
    onChange(pastedCode);
    inputRefs.current[Math.min(pastedCode.length, 5)]?.focus();
  }

  return (
    <div className="flex justify-center gap-1.5" role="group" aria-label="6자리 인증 코드">
      {Array.from({ length: 6 }, (_, index) => {
        const digit = value[index] === " " ? "" : (value[index] ?? "");
        return (
          <input
            key={index}
            ref={element => { inputRefs.current[index] = element; }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            value={digit}
            onChange={event => setDigit(index, event.target.value)}
            onKeyDown={event => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={event => event.currentTarget.select()}
            aria-label={`인증 코드 ${index + 1}번째 자리`}
            maxLength={6}
            disabled={disabled}
            // 채워진 칸은 테두리를 한 단계 밝혀서 붙여넣기·입력 진행 상황이 포커스 없이도 눈에 보이게 한다.
            className={`h-10 w-9 rounded-sm border bg-modal-box-color p-0 text-center font-mono text-lg text-primary-text-color outline-none transition-colors focus:border-service-color focus:ring-1 focus:ring-service-color/30 disabled:opacity-50 ${digit ? "border-border-strong-color" : "border-border-color"}`}
          />
        );
      })}
    </div>
  );
}
