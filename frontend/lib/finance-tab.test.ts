import { describe, it, expect } from 'vitest';
import { resolveFinanceTab } from './finance-tab';

describe('resolveFinanceTab', () => {
  it('sends an ?editTxn deep link to Transactions even when another tab was last used', () => {
    expect(resolveFinanceTab('?editTxn=abc123', 'monthly')).toBe('transactions');
  });

  it('restores the last-used tab when there is no deep link', () => {
    expect(resolveFinanceTab('', 'monthly')).toBe('monthly');
    expect(resolveFinanceTab('?foo=bar', 'flip-calc')).toBe('flip-calc');
  });

  it('falls back to Transactions with no saved tab or an unknown one', () => {
    expect(resolveFinanceTab('', null)).toBe('transactions');
    expect(resolveFinanceTab('', 'bogus')).toBe('transactions');
  });
});
