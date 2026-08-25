import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Side = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  label: string;
  side?: Side;
  /**
   * 트리거가 열어 놓은 UI(드롭다운·메뉴 등)를 툴팁이 가리는 동안 잠시 끄는 용도.
   * 켜져 있는 동안에는 호버해도 뜨지 않는다.
   */
  disabled?: boolean;
}

/** 트리거와 툴팁 사이 간격(px). */
const GAP = 8;
/** 뷰포트 가장자리에서 최소한 이만큼은 띄운다(px). */
const VIEWPORT_MARGIN = 8;
/** 화살표 정사각형의 한 변(px). w-1.5 h-1.5 = 6px 과 맞춘다. */
const ARROW_SIZE = 6;

function clamp(value: number, min: number, max: number): number {
  // 공간이 모자라 min > max 가 되면 min 쪽(좌/상단)을 살린다.
  return Math.max(min, Math.min(max, value));
}

export default function Tooltip({ children, label, side = 'top', disabled = false }: TooltipProps) {
  const [show, setShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  // 위치는 state 가 아니라 레이아웃 이펙트에서 DOM 에 직접 쓴다.
  // 측정 결과로 setState 하면 렌더가 한 번 더 도는 데다, 이펙트 안의 setState 는
  // 이 프로젝트 eslint 규칙에서 막혀 있다. 브라우저 레이아웃은 React 바깥의 상태라
  // 여기서 동기화하는 것이 맞다.
  const position = useCallback(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    const arrow = arrowRef.current;
    if (!container || !tooltip || !arrow) return;

    const anchor = container.getBoundingClientRect();
    const { width: tipWidth, height: tipHeight } = tooltip.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // 요청받은 방향에 공간이 없으면 반대쪽으로 뒤집는다.
    let placement: Side = side;
    if (side === 'top' && anchor.top - tipHeight - GAP < 0) placement = 'bottom';
    else if (side === 'bottom' && anchor.bottom + tipHeight + GAP > viewportHeight) placement = 'top';
    else if (side === 'left' && anchor.left - tipWidth - GAP < 0) placement = 'right';
    else if (side === 'right' && anchor.right + tipWidth + GAP > viewportWidth) placement = 'left';

    const isVertical = placement === 'top' || placement === 'bottom';

    // body 로 포탈되어 position:fixed 이므로 좌표계는 뷰포트다.
    let left = isVertical
      ? anchor.left + (anchor.width - tipWidth) / 2
      : placement === 'left' ? anchor.left - tipWidth - GAP : anchor.right + GAP;
    let top = isVertical
      ? placement === 'top' ? anchor.top - tipHeight - GAP : anchor.bottom + GAP
      : anchor.top + (anchor.height - tipHeight) / 2;

    // 뒤집기만으로는 교차축 삐져나감을 못 막는다. whitespace-nowrap 이라 툴팁이
    // 트리거보다 훨씬 넓어질 수 있어서, 화면 가장자리 버튼에서는 반드시 밀어 넣어야 한다.
    let shift = 0;
    if (isVertical) {
      const clamped = clamp(left, VIEWPORT_MARGIN, viewportWidth - tipWidth - VIEWPORT_MARGIN);
      shift = clamped - left;
      left = clamped;
    } else {
      const clamped = clamp(top, VIEWPORT_MARGIN, viewportHeight - tipHeight - VIEWPORT_MARGIN);
      shift = clamped - top;
      top = clamped;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';

    // 툴팁을 밀어낸 만큼 화살표를 되돌려야 계속 트리거 중앙을 가리킨다.
    // 다만 모서리를 넘지 않도록 툴팁 안쪽으로 가둔다.
    const arrowOffset = clamp(
      (isVertical ? tipWidth : tipHeight) / 2 - shift,
      ARROW_SIZE,
      (isVertical ? tipWidth : tipHeight) - ARROW_SIZE,
    );
    const edge = -ARROW_SIZE / 2;

    if (isVertical) {
      arrow.style.left = `${arrowOffset - ARROW_SIZE / 2}px`;
      arrow.style.top = placement === 'top' ? `${tipHeight + edge}px` : `${edge}px`;
    } else {
      arrow.style.top = `${arrowOffset - ARROW_SIZE / 2}px`;
      arrow.style.left = placement === 'left' ? `${tipWidth + edge}px` : `${edge}px`;
    }
  }, [side]);

  useLayoutEffect(() => {
    if (!show) return;
    position();

    // 툴팁이 뜬 채로 조상 컨테이너가 스크롤되면 트리거만 움직이고 툴팁은 남는다.
    // capture 로 받아야 window 가 아닌 내부 스크롤 컨테이너의 스크롤도 잡힌다.
    const reposition = () => position();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [show, label, position]);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      // 클릭은 곧 '이름표는 이미 읽었다'는 뜻이다. 게다가 트리거가 클릭으로 자리를
      // 옮기거나(접기 토글) 아래에 메뉴를 여는 경우, 툴팁만 남으면 유령처럼 보인다.
      // 포인터가 나갔다 다시 들어오면 그때 정상적으로 다시 뜬다.
      onClick={() => setShow(false)}
    >
      {children}
      {/* body 로 포탈한다. 조상에 overflow-hidden/auto 나 스택 컨텍스트가 있으면
          absolute 툴팁이 잘리거나 가려지는데, 툴팁은 트리거 박스보다 큰 것이 정상이라
          그 경계 안에 가둘 이유가 없다. */}
      {show && !disabled && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          // 측정 전에는 숨겨 둔다. 레이아웃 이펙트가 페인트 전에 위치를 잡으므로
          // 사용자에게는 어긋난 위치가 한 프레임도 보이지 않는다.
          style={{ visibility: 'hidden', left: 0, top: 0 }}
          className="optics-tooltip-in fixed z-[60] px-2.5 py-1.5 rounded-sm bg-modal-box-color border border-border-color text-2xs text-primary-text-color whitespace-nowrap shadow-[0_10px_24px_rgba(0,0,0,0.18)] pointer-events-none"
        >
          {label}
          <div
            ref={arrowRef}
            className="absolute w-1.5 h-1.5 bg-modal-box-color border border-border-color rotate-45"
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
