import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 남은 초를 1초씩 줄이는 카운트다운.
 * 재발송 쿨다운처럼 "언제 다시 누를 수 있는지" 보여줄 때 쓴다.
 */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((seconds: number) => {
    clear();
    setRemaining(Math.max(0, Math.ceil(seconds)));

    timerRef.current = window.setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clear();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clear]);

  // 컴포넌트가 사라진 뒤 타이머가 남아 setState 를 호출하지 않도록 정리한다.
  useEffect(() => clear, [clear]);

  return { remaining, start };
}
