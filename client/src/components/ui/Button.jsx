import { forwardRef } from 'react';

const variants = {
  primary: 'text-white bg-[var(--accent)] hover:bg-[var(--accent-dark)] shadow-[0_2px_8px_-2px_var(--accent)]',
  dark: 'bg-gray-900 text-white hover:bg-black',
  google: 'bg-blue-400 text-white hover:bg-blue-500',
  danger: 'bg-danger-soft text-danger hover:bg-danger-soft',
  dangerSolid: 'bg-danger text-white hover:bg-danger',
  ghost: 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--text)]',
};

const Button = forwardRef(function Button({ variant = 'primary', className = '', children, as: As = 'button', disabled, ...props }, ref) {
  return (
    <As
      ref={ref}
      aria-disabled={disabled || undefined}
      disabled={As === 'button' ? disabled : undefined}
      className={`rounded-full px-3 py-1 text-sm font-semibold inline-flex items-center justify-center transition-all active:scale-95
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </As>
  );
});

export default Button;
