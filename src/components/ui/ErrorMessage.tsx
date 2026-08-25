export default function ErrorMessage({ children }: { children: React.ReactNode }) {
  // role="alert" + aria-live 로 폼 제출 후 나타나는 에러를 스크린리더가 즉시 읽게 한다.
  return (
    <p role="alert" aria-live="polite" className="text-danger-color text-xs">
      {children}
    </p>
  );
}
