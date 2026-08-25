import { Users as UsersIcon } from "lucide-react";

export default function Users() {
  return (
    <div className="text-primary-text-color mt-16">
      <h1 className="text-lg font-bold mb-1">Users</h1>
      <p className="text-secondary-text-color text-sm mb-6 break-keep">워크스페이스 구성원을 관리하는 페이지입니다.</p>

      {/* 실 데이터 연동 전까지는 다른 페이지의 빈 상태(카드형, 은은한 아이콘)와 같은
          언어로만 "준비 중"임을 보여준다. */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border-color bg-modal-background-color py-16 text-center">
        <UsersIcon className="w-6 h-6 text-tertiary-text-color" />
        <p className="text-secondary-text-color text-sm">아직 준비 중인 페이지입니다.</p>
      </div>
    </div>
  )
}
