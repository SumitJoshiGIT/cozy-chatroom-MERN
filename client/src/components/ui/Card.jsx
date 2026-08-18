export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl shadow-lg ${className}`} {...props}>
      {children}
    </div>
  );
}
