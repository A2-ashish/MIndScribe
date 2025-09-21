import React, { createContext, useContext, useState } from 'react';

type TabsCtx = { value: string; setValue: (v: string) => void };
const Ctx = createContext<TabsCtx | null>(null);

export function Tabs({ children, className = '', defaultValue, value, onValueChange }: { children?: React.ReactNode, className?: string, defaultValue?: string, value?: string, onValueChange?: (v: string) => void }) {
  const [internal, setInternal] = useState<string>(defaultValue || 'overview');
  const current = value ?? internal;
  const setValue = (v: string) => {
    if (onValueChange) onValueChange(v);
    if (value === undefined) setInternal(v);
  };
  return <Ctx.Provider value={{ value: current, setValue }}><div className={className}>{children}</div></Ctx.Provider>;
}

export function TabsList({ children, className = '' }: { children?: React.ReactNode, className?: string }) {
  return <div className={`inline-grid bg-[#f2f4f7] rounded-lg p-1 gap-1 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string, children?: React.ReactNode }) {
  const ctx = useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      data-state={active ? 'active' : 'inactive'}
      className={`px-3 py-1 rounded-md text-sm ${active ? 'bg-white border border-[var(--color-outline)]' : 'opacity-80'}`}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = '' }: { value: string, children?: React.ReactNode, className?: string }) {
  const ctx = useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
