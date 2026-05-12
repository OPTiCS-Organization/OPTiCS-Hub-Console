export function Section({ sectionName, children }: { sectionName?: string, children?: React.ReactNode }) {
  return (
    <div className="border border-border-color rounded-sm p-5 relative mt-6">
      <span className="absolute text-sm bg-background-color -my-9 p-1">{sectionName}</span>
      {children}
    </div>
  )
}