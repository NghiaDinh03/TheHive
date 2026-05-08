'use client';

/**
 * Page sizer — mirrors TheHive 4 legacy page-sizer.html.
 * Compact page size selector for list views.
 */

type PageSizerProps = {
  value: number;
  onChange: (size: number) => void;
  sizes?: number[];
  className?: string;
};

const DEFAULT_SIZES = [10, 25, 50, 100, 200];

export function PageSizer({ value, onChange, sizes = DEFAULT_SIZES, className }: PageSizerProps) {
  return (
    <div className={`page-sizer ${className ?? ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <select
        className="form-control input-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 'auto' }}
      >
        {sizes.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <span className="page-sizer-label nowrap text-muted text-xs">per page</span>
    </div>
  );
}
