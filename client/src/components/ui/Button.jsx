const variants = {
  primary: 'text-white bg-[var(--accent)] hover:bg-[var(--accent-dark)] shadow-[0_2px_8px_-2px_var(--accent)]',
  dark: 'bg-gray-900 text-white hover:bg-black',
  google: 'bg-blue-400 text-white hover:bg-blue-500',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  dangerSolid: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600',
};

export default function Button({ variant = 'primary', className = '', children, as: As = 'button', disabled, ...props }) {
  return (
    <As
      aria-disabled={disabled || undefined}
      className={`rounded-full px-3 py-1 text-sm font-semibold inline-flex items-center justify-center transition-all active:scale-95
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}
