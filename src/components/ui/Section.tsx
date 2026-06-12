export function Section({ sectionName, children }: { sectionName?: string, children?: React.ReactNode }) {
  return (
    <div className="border border-border-color rounded-sm px-5 relative mt-10 pb-5">
      <span className="absolute text-sm bg-background-color -my-4 p-1">{sectionName}</span>
      {children}
    </div>
  )
}