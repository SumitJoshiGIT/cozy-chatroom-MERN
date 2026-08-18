import { forwardRef } from 'react';

export const TextField = forwardRef(function TextField({ accentColor, className = '', inputClassName = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      style={accentColor ? { borderColor: accentColor, ...props.style } : props.style}
      className={`bg-gray-100 text-gray-700 placeholder-gray-400 rounded-full border px-4 py-1.5 outline-none focus:ring-2 focus:ring-purple-200 ${accentColor ? 'border-l-4 rounded-l-md' : 'border-gray-200'} ${inputClassName} ${className}`}
    />
  );
});

export const TextArea = forwardRef(function TextArea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`bg-gray-100 text-gray-700 placeholder-gray-400 rounded-md border border-gray-200 px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-purple-200 ${className}`}
    />
  );
});
