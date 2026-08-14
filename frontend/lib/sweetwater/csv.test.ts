import { describe, expect, test } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  test('joins plain cells with commas and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  test('quotes cells containing a comma', () => {
    expect(toCsv([['Fender, USA']])).toBe('"Fender, USA"');
  });

  test('escapes embedded double quotes by doubling them', () => {
    expect(toCsv([['12" speaker']])).toBe('"12"" speaker"');
  });

  test('quotes cells containing newlines so descriptions survive', () => {
    expect(toCsv([['line one\nline two']])).toBe('"line one\nline two"');
  });

  test('renders null and undefined as empty cells rather than the string "null"', () => {
    expect(toCsv([[null, undefined, '']])).toBe(',,');
  });

  test('renders numbers without quoting', () => {
    expect(toCsv([[1500]])).toBe('1500');
  });

  test('quotes cells with leading or trailing whitespace that would otherwise be trimmed', () => {
    expect(toCsv([[' padded ']])).toBe('" padded "');
  });
});
