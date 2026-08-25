type SectionProps = {
  sectionName?: string;
  // 위험 구역(워크스페이스 삭제 등)을 나머지 설정과 시각적으로 분리하기 위한 톤.
  // 기본값은 일반 카드이고, "danger"는 테두리/헤더 글자만 danger 잉크로 바꾼다.
  tone?: "default" | "danger";
  /**
   * 섹션 전체에 걸리는 알림(경고 배너, 저장 실패 메시지 등).
   *
   * children 으로 넣으면 목록 항목 취급을 받아 구분선이 그어지고 py-4 가 덧붙는다.
   * 배너는 이미 자기 패딩을 갖고 있어 여백이 두 겹이 되고, 설정 한 줄처럼 보인다.
   * 알림은 목록 밖 자리라 따로 받는다.
   */
  notice?: React.ReactNode;
  children?: React.ReactNode;
};

export function Section({ sectionName, tone = "default", notice, children }: SectionProps) {
  const isDanger = tone === "danger";
  const line = isDanger ? "border-danger-color/30" : "border-border-color";

  return (
    // 예전에는 테두리 위에 라벨을 음수 마진으로 걸치는 방식이라 배경색에 종속적이었다.
    // 카드 서피스 + 헤더 바를 쓰면 목록임이 더 분명히 드러나고 색 결합도 줄어든다.
    <section className={`overflow-hidden rounded-md border bg-modal-box-color/30 ${isDanger ? "border-danger-color/30" : "border-border-color"}`}>
      {sectionName && (
        // 헤더의 아래 여백(py-3=12px)과 첫 항목의 위 여백(py-4=16px)을 합치면 28px 이 되어
        // 헤더가 목록에서 너무 멀어진다. 헤더는 위아래를 같게 두고 간격은 목록이 만든다.
        <div className={`border-b px-5 py-3 ${line}`}>
          <h2 className={`text-sm font-semibold ${isDanger ? "text-danger-color" : "text-primary-text-color"}`}>{sectionName}</h2>
        </div>
      )}

      {/* 알림은 목록 위에 놓되 구분선을 만들지 않는다. 아래 첫 항목의 py-4 가 간격을 만든다. */}
      {notice && <div className="px-5 pt-4">{notice}</div>}

      {/*
        항목 사이 구분선(divide)과 위아래 여백을 여기서 관리한다.
        SettingOption을 비롯한 자식들은 더 이상 자기 자신에게 mt-5를 주지 않으므로,
        목록의 리듬(간격)은 항상 이 컨테이너 하나가 결정한다.
      */}
      <div className={`flex flex-col divide-y px-5 [&>*]:py-4 ${isDanger ? "divide-danger-color/20" : "divide-border-color"}`}>
        {children}
      </div>
    </section>
  );
}
