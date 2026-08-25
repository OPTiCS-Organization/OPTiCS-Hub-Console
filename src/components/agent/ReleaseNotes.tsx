import { Fragment, type ReactNode } from "react";

/**
 * GitHub Release 본문을 렌더링한다.
 *
 * 릴리즈 노트가 쓰는 마크다운은 제목 / 목록 / 굵게 / 인라인 코드 정도로 좁다.
 * 그 부분집합만 직접 처리해서 라이브러리 의존과 dangerouslySetInnerHTML을 둘 다 피한다.
 * 본문은 GitHub에서 오는 외부 문자열이므로 HTML로 해석하지 않는 것이 중요하다.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

/** 굵게와 인라인 코드만 처리한다. 나머지 기호는 글자 그대로 남긴다. */
function renderInline(text: string): ReactNode {
  return text.split(INLINE).map((chunk, index) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      return <strong key={index} className="font-semibold text-primary-text-color">{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      return (
        <code key={index} className="rounded-xs bg-white/7.5 px-1 py-0.5 font-mono text-[10px]">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{chunk}</Fragment>;
  });
}

export default function ReleaseNotes({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex flex-col gap-0.5 pl-3">
        {listItems.map((item, index) => (
          <li
            key={index}
            className="relative break-keep wrap-break-word before:absolute before:-left-3 before:text-tertiary-text-color before:content-['·']"
          >
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      blocks.push(
        <p key={`h-${blocks.length}`} className="text-[10px] font-semibold uppercase tracking-widest text-secondary-text-color/80">
          {renderInline(heading[1])}
        </p>,
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="break-keep wrap-break-word">
        {renderInline(trimmed)}
      </p>,
    );
  }
  flushList();

  return <div className="flex flex-col gap-2 text-[11px] leading-relaxed">{blocks}</div>;
}
