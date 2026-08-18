import { forwardRef } from 'react';

const disabledCls = 'disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:cursor-default';

export const TextField = forwardRef(function TextField({ accentColor, className = '', inputClassName = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      style={accentColor ? { borderColor: accentColor, ...props.style } : props.style}
      className={`bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-full border px-4 py-1.5 outline-none focus:ring-2 focus:ring-[var(--accent-light)] transition-colors ${disabledCls} ${accentColor ? 'border-l-4 rounded-l-md' : 'border-gray-200 dark:border-gray-600'} ${inputClassName} ${className}`}
    />
  );
});

export const TextArea = forwardRef(function TextArea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md border border-gray-200 dark:border-gray-600 px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-[var(--accent-light)] transition-colors ${disabledCls} ${className}`}
    />
  );
});
