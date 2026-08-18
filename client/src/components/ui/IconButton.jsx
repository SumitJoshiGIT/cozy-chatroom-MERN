const sizes = {
  sm: { btn: 'p-1', icon: 'w-4 h-4' },
  md: { btn: 'p-1.5', icon: 'w-5 h-5' },
  lg: { btn: 'p-2', icon: 'w-6 h-6' },
};

export default function IconButton({ icon, alt = '', size = 'md', onClick, className = '', ariaLabel, type = 'button', disabled }) {
  const s = sizes[size] || sizes.md;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || alt}
      className={`rounded-full ${s.btn} outline-none border-none flex items-center justify-center hover:bg-black/5 active:outline-none active:scale-95 transition-all
        ${disabled ? 'opacity-30 pointer-events-none' : ''} ${className}`}
    >
      <img className={`${s.icon} opacity-70`} src={icon} alt={alt} />
    </button>
  );
}
