export default function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-red-400 text-xs">{children}</p>;
}
