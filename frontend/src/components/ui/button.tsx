import React from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'ghost' | 'outline';

export function Button({
  variant = 'primary',
  className = '',
  style,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'filter 120ms ease, background 120ms ease',
  };

  const variantStyle: Record<Variant, React.CSSProperties> = {
    primary: {
      background: 'var(--color-accent)',
      color: '#fff',
      border: '1px solid var(--color-accent)'
    },
    secondary: {
      background: '#fff',
      color: 'var(--color-on-surface)',
      border: '1px solid var(--color-outline)'
    },
    success: {
      background: '#34d399',
      color: '#fff',
      border: '1px solid #34d399'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-on-surface)',
      border: '1px solid transparent'
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-on-surface)',
      border: '1px solid var(--color-outline)'
    },
  };

  return (
    <button
      className={className}
      style={{ ...baseStyle, ...variantStyle[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
