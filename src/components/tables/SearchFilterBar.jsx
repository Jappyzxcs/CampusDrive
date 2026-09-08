import { Icon } from '../common/Icon';

/**
 * filters: [{ key, label, options: [{ value, label }] }]
 * activeFilters: { [key]: value }
 */
export function SearchFilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Search…', filters = [], activeFilters = {}, onFilterChange }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900
            placeholder:text-slate-400 focus-visible:border-primary-500"
        />
      </div>

      {filters.map((filter) => (
        <select
          key={filter.key}
          value={activeFilters[filter.key] ?? ''}
          onChange={(e) => onFilterChange(filter.key, e.target.value)}
          className="rounded-md border border-slate-300 py-2 pl-3 pr-8 text-sm text-slate-700 focus-visible:border-primary-500"
        >
          <option value="">{filter.label}: All</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
