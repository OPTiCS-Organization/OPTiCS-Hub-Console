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
        <code key={index} className="rounded-xs bg-white/7.5 px-1 py-0.5 align-[0.05em] font-mono text-xs">
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
      /*
        불릿을 ::before 절대배치로 달면 top:auto 의 정적 위치가 줄상자 위쪽이라,
        leading 이 커질수록 점만 글자보다 위로 뜬다. flex 로 놓으면 점과 글줄이
        같은 줄상자를 공유해 행높이를 바꿔도 항상 첫 줄에 맞고, 여러 줄로 접힐 때
        내어쓰기도 저절로 된다.
      */
      <ul key={`ul-${blocks.length}`} className="mt-1.5 flex flex-col gap-1">
        {listItems.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden className="w-1 shrink-0 select-none text-tertiary-text-color">·</span>
            <span className="min-w-0 break-keep wrap-break-word">{renderInline(item)}</span>
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
        /* 제목은 아래 목록의 머리라 위쪽 여백만 크게 준다. tracking-widest 는
           한글 제목("수정", "변경")에서 글자가 흩어져 보여 한 단계 줄인다. */
        <p key={`h-${blocks.length}`} className="mt-4 text-xs font-semibold uppercase leading-normal tracking-wide text-secondary-text-color first:mt-0">
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
      <p key={`p-${blocks.length}`} className="mt-2.5 break-keep wrap-break-word first:mt-0">
        {renderInline(trimmed)}
      </p>,
    );
  }
  flushList();

  // 블록마다 위쪽 여백을 직접 들고 있으므로 컨테이너에서 gap 을 주지 않는다.
  // 제목 앞과 목록 항목 사이에 필요한 간격이 서로 달라, 일률적인 gap 으로는 안 맞는다.
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
