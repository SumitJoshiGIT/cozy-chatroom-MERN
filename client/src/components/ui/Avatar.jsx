import single from '/single.svg';
import group from '/group.svg';

const sizes = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
  '2xl': 'w-36 h-36',
};

export default function Avatar({ src, kind = 'user', size = 'md', className = '', imgClassName = '', style }) {
  const dim = sizes[size] || sizes.md;
  const fallback = kind === 'group' ? group : single;
  return (
    <img
      className={`${dim} border rounded-full bg-white object-cover shrink-0 ${imgClassName} ${className}`}
      style={{ backgroundColor: 'white', ...style }}
      src={src || fallback}
      alt=""
    />
  );
}
