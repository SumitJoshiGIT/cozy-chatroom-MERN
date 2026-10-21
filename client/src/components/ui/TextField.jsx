import { forwardRef } from 'react';

const disabledCls = 'disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:cursor-default';

export const TextField = forwardRef(function TextField({ accentColor, className = '', inputClassName = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      style={accentColor ? { borderColor: accentColor, ...props.style } : props.style}
      className={`glass-field bg-[var(--surface-muted)] text-[var(--text)] placeholder-[var(--text-muted)] rounded-full border px-4 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-colors ${disabledCls} ${accentColor ? 'border-l-4 rounded-l-md' : 'border-[var(--border)]'} ${inputClassName} ${className}`}
    />
  );
});

export const TextArea = forwardRef(function TextArea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`glass-field bg-[var(--surface-muted)] text-[var(--text)] placeholder-[var(--text-muted)] rounded-xl border border-[var(--border)] px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-[var(--accent-light)] transition-colors ${disabledCls} ${className}`}
    />
  );
});
