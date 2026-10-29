/**
 * Prints the mobile audit as one summary table (route, role, width, pass/fail,
 * offenders) and writes the full detail, tap-target flags included, to
 * mobile-audit/report.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface Row {
  route: string; state: string; role: string; width: string; pass: boolean; skipped?: string;
  offenders: { kind: string; selector: string; text: string; overPx: number }[];
  smallTargets: { selector: string; text: string; size: string }[];
}

export default class SummaryReporter implements Reporter {
  private rows: Row[] = [];

  onTestEnd(_test: TestCase, result: TestResult) {
    const att = result.attachments.find((a) => a.name === 'mobile-audit' && a.body);
    if (att?.body) this.rows.push(...(JSON.parse(att.body.toString()) as Row[]));
  }

  onEnd() {
    if (this.rows.length === 0) return;
    const out = path.join(__dirname, '..', 'mobile-audit', 'report.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(this.rows, null, 2));

    // One line per route/role/width: pass only if every UI state on it passed.
    const groups = new Map<string, Row[]>();
    for (const r of this.rows) {
      const key = `${r.route}\t${r.role}\t${r.width}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const lines: string[][] = [['ROUTE', 'ROLE', 'WIDTH', 'RESULT', 'SMALL TAPS', 'OFFENDERS']];
    let failed = 0;
    for (const [key, rows] of groups) {
      const [route, role, width] = key.split('\t');
      const bad = rows.filter((r) => !r.pass);
      const skipped = rows.find((r) => r.skipped && r.state === 'page');
      if (bad.length) failed++;
      const taps = new Set(rows.flatMap((r) => r.smallTargets.map((s) => s.selector + s.text))).size;
      const offenders = bad
        .flatMap((r) => r.offenders.map((o) => `[${r.state}] ${o.selector} "${o.text}" +${o.overPx}px`))
        .slice(0, 3)
        .join(' | ');
      lines.push([route, role, width, skipped ? 'SKIP' : bad.length ? 'FAIL' : 'pass', String(taps), offenders || skipped?.skipped || '']);
    }
    const widths = lines[0].map((_, c) => Math.min(60, Math.max(...lines.map((l) => (c === 5 ? 0 : l[c].length)))));
    console.log('\nMobile audit summary');
    for (const l of lines) console.log(l.map((v, c) => (c === 5 ? v : v.padEnd(widths[c]))).join('  '));
    console.log(`\n${groups.size - failed}/${groups.size} route/role/width combinations pass. Detail: ${out}`);
  }
}
