export default function Divider({ children }) {
  return (
    <div className="flex items-center gap-3 w-full my-1">
      <div className="flex-1 h-px bg-gray-200" />
      {children && <span className="text-xs font-medium text-gray-400">{children}</span>}
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
