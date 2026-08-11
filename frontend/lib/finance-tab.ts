// Which Finances sub-tab to show on load. A deep link (?editTxn=<id>) targets
// the Transactions tab and must win over the last-used tab in localStorage --
// otherwise the restored tab unmounts TransactionsTab and the deep link is lost.

export const FINANCE_TABS = ['transactions', 'dashboard', 'monthly', 'expenses', 'flip-calc'] as const;

export type FinanceTab = (typeof FINANCE_TABS)[number];

export const DEFAULT_FINANCE_TAB: FinanceTab = 'transactions';

export function isFinanceTab(value: string | null | undefined): value is FinanceTab {
  return !!value && (FINANCE_TABS as readonly string[]).includes(value);
}

/**
 * @param search   window.location.search (e.g. "?editTxn=abc123")
 * @param savedTab localStorage 'adminFinanceTab' value, if any
 */
export function resolveFinanceTab(search: string, savedTab: string | null): FinanceTab {
  if (new URLSearchParams(search).get('editTxn')) return 'transactions';
  if (isFinanceTab(savedTab)) return savedTab;
  return DEFAULT_FINANCE_TAB;
}
