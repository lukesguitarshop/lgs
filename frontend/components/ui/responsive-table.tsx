'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One table, two layouts. Columns are declared once; at md and up they render
 * as a normal table (scrolling inside its own box, first column sticky), and
 * below md each row becomes a card built from the same column definitions. A
 * new column therefore lands on phones too, in the slot its `priority` names.
 *
 * Phone card anatomy, by priority:
 *   primary  – card title (clamped to 2 lines)
 *   badge    – small chips under the title (type, status, platform…)
 *   key      – the 2-column label/value grid
 *   detail   – behind a "Details" expander
 *   actions  – card footer, wrapping, 44px tap targets
 *   desktop  – table only (selection checkboxes, thumbnails…)
 */
export type ColumnPriority = 'primary' | 'badge' | 'key' | 'detail' | 'actions' | 'desktop';

export interface ResponsiveColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  priority: ColumnPriority;
  /** Card rendering when it should differ from the table cell. */
  mobileCell?: (row: T) => React.ReactNode;
  /** Label in the card grid. Defaults to `header` when that's a string. */
  mobileLabel?: string;
  /** The row has nothing for this column: the card hides it, or shows `emptyLabel`. */
  isEmpty?: (row: T) => boolean;
  emptyLabel?: string;
  /** Spans both card-grid columns (addresses, long text, inputs). */
  wide?: boolean;
  /** Makes the header (and the phone sort menu entry) sort by this key. */
  sortKey?: string;
  headerClassName?: string;
  cellClassName?: string | ((row: T) => string);
  /** Clicks in this cell don't fire onRowClick (links, buttons, inputs). */
  stopRowClick?: boolean;
  /** Card-only field, e.g. a value the table folds into another column. */
  hideOnDesktop?: boolean;
  /** Extra chip for the card header, for state the table shows inline (e.g. "Action needed"). */
  mobileBadge?: (row: T) => React.ReactNode;
}

export interface ResponsiveTableSort {
  key: string;
  direction: 'asc' | 'desc';
  /** Same key again flips the direction, a new key starts a fresh sort. */
  onSort: (key: string) => void;
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  /** Rows for <tfoot> (totals). They follow the cards on phones. */
  footerRows?: T[];
  footerRowClassName?: (row: T) => string;
  /** Hand-built <tfoot> rows (colSpan totals) and their phone counterpart. */
  tableFooter?: React.ReactNode;
  mobileFooter?: React.ReactNode;
  sort?: ResponsiveTableSort;
  /** Desktop look, so each table keeps its existing styling at md and up. */
  tableClassName?: string;
  containerClassName?: string;
  theadClassName?: string;
  headerRowClassName?: string;
  thClassName?: string;
  sortableThClassName?: string;
  tdClassName?: string;
  /**
   * Background behind the table. The sticky first column paints it so rows
   * scrolling underneath don't show through, and rows default to it.
   */
  surfaceClassName?: string;
  stickyFirstColumn?: boolean;
  /** Phones render this many cards, then "Show more". */
  mobilePageSize?: number;
  cardClassName?: (row: T) => string;
  /** Accessible name for the table and the card list. */
  label?: string;
}

function isBlank(node: React.ReactNode) {
  return node === null || node === undefined || node === false || node === '' || node === '—' || node === '-';
}

function headerText(c: ResponsiveColumn<unknown>) {
  return c.mobileLabel ?? (typeof c.header === 'string' ? c.header : c.id);
}

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  footerRows,
  footerRowClassName,
  tableFooter,
  mobileFooter,
  sort,
  tableClassName = 'w-full text-sm',
  containerClassName,
  theadClassName,
  headerRowClassName,
  thClassName = 'text-left py-3 px-2 font-medium text-gray-700',
  sortableThClassName = 'cursor-pointer select-none',
  tdClassName = 'py-3 px-2',
  surfaceClassName = 'bg-[#FFFFF3]',
  stickyFirstColumn = true,
  mobilePageSize = 25,
  cardClassName,
  label,
}: ResponsiveTableProps<T>) {
  // Rows can be recomputed every render, so reset "Show more" on what they are,
  // not on array identity.
  const resetKey = `${rows.length}:${rows.length ? rowKey(rows[0], 0) : ''}`;
  const [mobileLimit, setMobileLimit] = React.useState(mobilePageSize);
  React.useEffect(() => setMobileLimit(mobilePageSize), [resetKey, mobilePageSize]);

  const tableColumns = columns.filter((c) => !c.hideOnDesktop);
  const sticky = (i: number) =>
    stickyFirstColumn && i === 0 ? 'sticky left-0 z-[1] bg-inherit' : '';
  const cellClass = (c: ResponsiveColumn<T>, row: T) =>
    typeof c.cellClassName === 'function' ? c.cellClassName(row) : c.cellClassName;

  const renderRow = (row: T, index: number, extraClass?: string, clickable = true) => (
    <tr
      key={rowKey(row, index)}
      className={cn(surfaceClassName, extraClass)}
      onClick={clickable && onRowClick ? () => onRowClick(row) : undefined}
    >
      {tableColumns.map((c, i) => (
        <td
          key={c.id}
          className={cn(tdClassName, cellClass(c, row), sticky(i))}
          onClick={c.stopRowClick ? stopPropagation : undefined}
        >
          {c.cell(row)}
        </td>
      ))}
    </tr>
  );

  const by = (p: ColumnPriority) => columns.filter((c) => c.priority === p);
  const primary = by('primary');
  const badges = by('badge');
  const keyCols = by('key');
  const details = by('detail');
  const actions = by('actions');
  const sortable = columns.filter((c) => c.sortKey);

  const field = (c: ResponsiveColumn<T>, row: T) => {
    const value = c.isEmpty?.(row) ? null : (c.mobileCell ?? c.cell)(row);
    if (isBlank(value) && !c.emptyLabel) return null;
    return (
      <div key={c.id} className={cn('min-w-0', c.wide && 'col-span-2')}>
        <dt className="text-xs text-gray-500">{headerText(c as ResponsiveColumn<unknown>)}</dt>
        <dd
          className="mt-0.5 min-w-0 break-words text-sm text-[#020E1C] [&_input]:w-full [&_input]:max-w-full [&_select]:w-full [&_select]:max-w-full"
          onClick={c.stopRowClick ? stopPropagation : undefined}
        >
          {isBlank(value) ? <span className="text-gray-400">{c.emptyLabel}</span> : value}
        </dd>
      </div>
    );
  };

  const renderCard = (row: T, index: number, extraClass?: string, clickable = true) => {
    const keyFields = keyCols.map((c) => field(c, row)).filter(Boolean);
    const detailFields = details.map((c) => field(c, row)).filter(Boolean);
    const badgeNodes = [
      ...columns.map((c) => c.mobileBadge?.(row)),
      ...badges.map((c) => (c.isEmpty?.(row) ? null : (c.mobileCell ?? c.cell)(row))),
    ].filter((n) => !isBlank(n));
    const actionNodes = actions
      .map((c) => (c.isEmpty?.(row) ? null : (c.mobileCell ?? c.cell)(row)))
      .filter((n) => !isBlank(n));
    const click = clickable && onRowClick ? () => onRowClick(row) : undefined;

    return (
      <li
        key={rowKey(row, index)}
        className={cn(
          'min-w-0 rounded-lg border border-gray-200 p-4',
          surfaceClassName,
          click && 'cursor-pointer active:bg-gray-50',
          extraClass,
          cardClassName?.(row)
        )}
        onClick={click}
      >
        {primary.length > 0 && (
          <div className="line-clamp-2 break-words font-medium text-[#020E1C]">
            {primary.map((c) => (
              <React.Fragment key={c.id}>{(c.mobileCell ?? c.cell)(row)}</React.Fragment>
            ))}
          </div>
        )}
        {badgeNodes.length > 0 && (
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
            {badgeNodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
          </div>
        )}
        {keyFields.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">{keyFields}</dl>
        )}
        {detailFields.length > 0 && (
          <details className="group mt-3 border-t border-gray-100" onClick={stopPropagation}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#6E0114] [&::-webkit-details-marker]:hidden">
              Details
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 pb-1">{detailFields}</dl>
          </details>
        )}
        {actionNodes.length > 0 && (
          <div
            className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-gray-100 pt-3 [&_a]:min-h-11 [&_a]:min-w-11 [&_button]:min-h-11 [&_button]:min-w-11"
            onClick={stopPropagation}
          >
            {actionNodes.map((n, i) => <React.Fragment key={i}>{n}</React.Fragment>)}
          </div>
        )}
      </li>
    );
  };

  const visibleRows = rows.slice(0, mobileLimit);
  const remaining = rows.length - visibleRows.length;

  // One root element: a parent's space-y-* treats this exactly like the old
  // single table wrapper, whichever layout is showing.
  return (
    <div className="min-w-0">
      <div className={cn('hidden md:block overflow-x-auto', containerClassName)}>
        <table className={tableClassName} aria-label={label}>
          <thead className={theadClassName}>
            <tr className={cn(surfaceClassName, headerRowClassName)}>
              {tableColumns.map((c, i) => {
                const sortable = sort && c.sortKey;
                return (
                  <th
                    key={c.id}
                    className={cn(thClassName, sortable && sortableThClassName, c.headerClassName, sticky(i))}
                    onClick={sortable ? () => sort.onSort(c.sortKey!) : undefined}
                    aria-sort={
                      sortable && sort.key === c.sortKey
                        ? sort.direction === 'asc' ? 'ascending' : 'descending'
                        : undefined
                    }
                  >
                    {sortable ? (
                      <span className="flex items-center gap-1">
                        {c.header}
                        {sort.key === c.sortKey && (
                          <span className="text-xs">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </span>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{rows.map((row, i) => renderRow(row, i, rowClassName?.(row)))}</tbody>
          {((footerRows && footerRows.length > 0) || tableFooter) && (
            <tfoot>
              {footerRows?.map((row, i) => renderRow(row, i, footerRowClassName?.(row), false))}
              {tableFooter}
            </tfoot>
          )}
        </table>
      </div>

      <div className="min-w-0 md:hidden">
        {sort && sortable.length > 1 && (
          <div className="mb-3 flex items-center gap-2">
            <label className="shrink-0 text-sm text-gray-600" htmlFor={`${label ?? 'table'}-sort`}>
              Sort by
            </label>
            <select
              id={`${label ?? 'table'}-sort`}
              value={sort.key}
              onChange={(e) => sort.onSort(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              {sortable.map((c) => (
                <option key={c.id} value={c.sortKey}>
                  {headerText(c as ResponsiveColumn<unknown>)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => sort.onSort(sort.key)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700"
              aria-label={sort.direction === 'asc' ? 'Sorted ascending, reverse' : 'Sorted descending, reverse'}
            >
              {sort.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </button>
          </div>
        )}
        <ul className="space-y-3" aria-label={label}>
          {visibleRows.map((row, i) => renderCard(row, i, rowClassName?.(row)))}
          {remaining <= 0 &&
            footerRows?.map((row, i) => renderCard(row, i, footerRowClassName?.(row), false))}
        </ul>
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setMobileLimit((n) => n + mobilePageSize)}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-[#020E1C]"
          >
            Show {Math.min(remaining, mobilePageSize)} more ({remaining} left)
          </button>
        )}
        {mobileFooter}
      </div>
    </div>
  );
}
