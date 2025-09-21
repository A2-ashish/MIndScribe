import React, { useEffect, useRef, useState } from 'react';

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [open]);

  return (
    <span ref={ref}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {children}
      {open && (
        <div role="tooltip" style={{ position: 'fixed', left: pos.x, top: pos.y - 10, transform: 'translate(-50%, -100%)', background: '#111', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', pointerEvents: 'none', zIndex: 40 }}>
          {content}
        </div>
      )}
    </span>
  );
}
