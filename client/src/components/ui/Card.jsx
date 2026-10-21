export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`glass-card bg-[var(--surface-raised)] text-[var(--text)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow)] ${className}`} {...props}>
      {children}
    </div>
  );
}
