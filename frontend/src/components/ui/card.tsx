import React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & { className?: string };

export function Card({ className = '', children, ...rest }: Props) {
  return (
    <div className={`bg-white border border-[var(--color-outline)] rounded-xl shadow-sm ${className}`} {...rest}>{children}</div>
  );
}

export function CardHeader({ className = '', children, ...rest }: Props) {
  return <div className={`px-4 py-3 ${className}`} {...rest}>{children}</div>;
}

export function CardContent({ className = '', children, ...rest }: Props) {
  return <div className={`px-4 py-3 ${className}`} {...rest}>{children}</div>;
}
