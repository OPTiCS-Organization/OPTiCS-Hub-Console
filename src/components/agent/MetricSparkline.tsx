import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * 스탯 타일에 딸린 추이 그래프.
 *
 * y축을 0~100%로 고정하면 CPU 4%는 바닥에, 메모리 85%는 천장에 붙은 직선이 되어
 * 변화를 전혀 읽을 수 없다. 그래서 데이터 자체의 범위에 맞춰 그린다.
 * 다만 순수 min/max 스케일링은 4.0%와 4.1% 사이의 잡음을 산맥처럼 과장하므로
 * 최소 표시 범위를 둬서 그 왜곡을 막는다.
 */
const MIN_SPAN = 0.1;

const HEIGHT = 44;
const PAD_Y = 5;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** 값이 들어갈 창. 중앙을 유지하되 0~1 밖으로 나가지 않게 민다. */
function scaleWindow(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, MIN_SPAN);
  const center = (max + min) / 2;

  let low = center - span / 2;
  if (low < 0) low = 0;
  if (low + span > 1) low = Math.max(0, 1 - span);
  return { low, high: low + span };
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function MetricSparkline({
  data,
  label,
  sampleSeconds,
}: {
  data: number[];
  /** 스크린리더와 툴팁이 쓰는 계열 이름. */
  label: string;
  /** 표본 간격(초). 창 길이와 '몇 초 전'을 여기서 계산한다. */
  sampleSeconds: number;
}) {
  const gradientId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // viewBox를 늘려 그리면 선 굵기와 점이 가로로 찌그러진다. 실제 폭을 재서 1:1로 그린다.
  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const values = data.map(clamp01);
  const enoughData = values.length >= 2 && width > 0;

  const moveActive = useCallback((delta: number) => {
    setActiveIndex(prev => {
      const base = prev ?? values.length - 1;
      return Math.min(values.length - 1, Math.max(0, base + delta));
    });
  }, [values.length]);

  if (!enoughData) {
    return (
      <div ref={wrapperRef} className="flex h-11 items-center text-3xs text-secondary-text-color/50">
        {width > 0 ? '데이터 수집 중' : ''}
      </div>
    );
  }

  const { low, high } = scaleWindow(values);
  const usable = HEIGHT - PAD_Y * 2;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((value, index) => ({
    x: index * step,
    y: PAD_Y + (1 - (value - low) / (high - low)) * usable,
  }));

  const line = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} ${width},${HEIGHT} 0,${HEIGHT}`;
  const latest = values[values.length - 1];
  const windowSeconds = Math.round((values.length - 1) * sampleSeconds);
  // 재연결 등으로 표본이 줄면 저장된 인덱스가 범위를 벗어난다. 상태를 고치지 않고 읽을 때 좁힌다.
  const safeIndex = activeIndex === null ? null : Math.min(activeIndex, values.length - 1);
  const active = safeIndex === null ? null : { index: safeIndex, point: points[safeIndex], value: values[safeIndex] };
  const secondsAgo = active ? Math.round((values.length - 1 - active.index) * sampleSeconds) : 0;

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    // 가장 가까운 표본으로 붙는다. 사용자는 2px 선이 아니라 시점을 겨냥한다.
    setActiveIndex(Math.min(values.length - 1, Math.max(0, Math.round(ratio * (values.length - 1)))));
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={wrapperRef}
        className="relative cursor-crosshair rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-service-color/50"
        style={{ height: HEIGHT }}
        tabIndex={0}
        role="img"
        aria-label={
          active
            ? `${label} ${secondsAgo}초 전 ${percent(active.value)}`
            : `${label} 최근 ${windowSeconds}초 추이, 현재 ${percent(latest)}, 범위 ${percent(low)}에서 ${percent(high)}`
        }
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActiveIndex(null)}
        onFocus={() => setActiveIndex(values.length - 1)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); moveActive(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); moveActive(1); }
        }}
      >
        <svg width={width} height={HEIGHT} className="block">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-service-color)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--color-service-color)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 기준선. 점선이 아니라 실선 헤어라인이어야 '임계값'으로 오해되지 않는다. */}
          <line x1="0" y1={HEIGHT - 0.5} x2={width} y2={HEIGHT - 0.5} stroke="var(--color-border-color)" strokeWidth="1" />

          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-service-color)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {active && (
            <g>
              <line
                x1={active.point.x} y1="0" x2={active.point.x} y2={HEIGHT}
                stroke="var(--color-border-color)" strokeWidth="1"
              />
              {/* 표면색 링으로 마크를 배경에서 떼어낸다. 테두리를 그리는 것과 다르다. */}
              <circle
                cx={active.point.x} cy={active.point.y} r="3.5"
                fill="var(--color-service-color)"
                stroke="var(--color-modal-box-color)" strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-border-color bg-modal-background-color px-1.5 py-1 whitespace-nowrap shadow-lg"
            style={{ left: Math.min(width - 44, Math.max(44, active.point.x)), top: Math.max(18, active.point.y - 6) }}
          >
            {/* 값이 앞서고 이름이 뒤따른다. 읽는 사람은 계열을 이미 알고 숫자를 원한다. */}
            <span className="text-2xs font-semibold text-primary-text-color">{percent(active.value)}</span>
            <span className="ml-1.5 text-4xs text-secondary-text-color">
              {secondsAgo === 0 ? '현재' : `${secondsAgo}초 전`}
            </span>
          </div>
        )}
      </div>

      {/* 자동 스케일이므로 축을 밝히지 않으면 절대값을 오해한다. */}
      <div className="flex items-center justify-between text-4xs font-mono text-secondary-text-color/40">
        <span>최근 {windowSeconds}초</span>
        <span>{percent(low)} ~ {percent(high)}</span>
      </div>
    </div>
  );
}
