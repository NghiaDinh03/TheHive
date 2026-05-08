'use client';

/**
 * Filter box — mirrors TheHive 4 legacy filter-box.html.
 * Compact search/filter input with clear and submit buttons.
 */

import { Search, Times } from '@/components/FaIcon';

type FilterBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
};

export function FilterBox({ value, onChange, onSubmit, placeholder = 'Filter', className }: FilterBoxProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.();
  }

  return (
    <form className={`filter-box ${className ?? ''}`} onSubmit={handleSubmit}>
      <div className="input-group">
        <input
          type="text"
          className="form-control input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          size={50}
        />
        <span className="input-group-btn">
          {value && (
            <button type="button" className="btn btn-default btn-sm" onClick={() => onChange('')}>
              <Times size={12} className="text-danger" />
            </button>
          )}
          <button type="submit" className="btn btn-default btn-sm">
            <Search size={12} className="text-default" />
          </button>
        </span>
      </div>
    </form>
  );
}
