const sizes = {
  xs: 'w-3 h-3 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export default function Spinner({ size = 'md', color = 'var(--accent)', className = '', ariaLabel = 'Loading' }) {
  const s = sizes[size] || sizes.md;
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      style={{ borderColor: color, borderTopColor: 'transparent' }}
      className={`inline-block rounded-full animate-spin ${s} ${className}`}
    />
  );
}
