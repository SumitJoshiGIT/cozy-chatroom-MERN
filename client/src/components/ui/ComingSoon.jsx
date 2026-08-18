export default function ComingSoon({ title, body }) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 text-center px-6 animate-fade-in">
      <div className="text-3xl">🌱</div>
      <div className="font-semibold text-gray-700">{title || 'Coming soon'}</div>
      {body && <div className="text-sm text-gray-400 max-w-56">{body}</div>}
    </div>
  );
}
