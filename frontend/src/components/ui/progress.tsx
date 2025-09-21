type ProgressProps = {
  value?: number;
  className?: string;
  trackColor?: string;
  filledColor?: string;
  remainderColor?: string;
  remainderStyle?: 'cap' | 'full';
  capRatio?: number; // portion of remaining used for cap width (0..1)
  capMin?: number;   // min cap width in percent
  capMax?: number;   // max cap width in percent
};

export function Progress({
  value = 0,
  className = '',
  trackColor = '#eee',
  filledColor = '#8b5cf6',
  remainderColor = '#d1fae5',
  remainderStyle = 'cap',
  capRatio = 0.3,
  capMin = 6,
  capMax = 22,
}: ProgressProps) {
  const v = Math.max(0, Math.min(100, value));
  // Two layers: purple filled portion and configurable green remainder presentation
  const filled = v;
  const remaining = Math.max(0, 100 - v);
  // Scale cap with remaining, clamped for pleasing visuals
  const cap = Math.max(capMin, Math.min(capMax, remaining * Math.max(0, Math.min(1, capRatio))));
  return (
    <div
      className={`w-full h-3 rounded-full overflow-hidden relative ${className}`}
      style={{ background: trackColor }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      role="progressbar"
    >
      {/* Filled portion */}
      <div
        className="h-full absolute left-0 top-0"
        style={{ width: `${filled}%`, background: filledColor, transition: 'width 400ms ease' }}
      />
      {/* Remainder visualization */}
      {remaining > 0 && (
        remainderStyle === 'cap' ? (
          cap > 0 ? (
            <div
              className="h-full absolute top-0"
              style={{ left: `${filled}%`, width: `${cap}%`, background: remainderColor, transition: 'left 400ms ease, width 400ms ease' }}
            />
          ) : null
        ) : (
          <div
            className="h-full absolute top-0"
            style={{ left: `${filled}%`, width: `${remaining}%`, background: remainderColor, transition: 'left 400ms ease, width 400ms ease' }}
          />
        )
      )}
    </div>
  );
}
