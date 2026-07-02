import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TRENDS_DIR = path.join(ROOT, 'public', 'data', 'trends');

function rangeFromLabel(label) {
  const [startDate, endDate] = String(label || '').split(' - ').map((value) => value?.replaceAll('.', '-'));
  return { startDate, endDate };
}

describe('published weekly trend JSON partitions', () => {
  it('includes the current W27 week in the manifest for 2026-07-02 KST', () => {
    const weeks = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'weeks.json'), 'utf8'));

    expect(weeks[0]).toMatchObject({
      weekId: '2026-W27',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      isLatest: true
    });
  });

  it('keeps each weekly JSON evidence inside that week label date range', () => {
    const files = fs.readdirSync(TRENDS_DIR).filter((file) => /^\d{4}-W\d{2}\.json$/.test(file));
    const violations = [];

    for (const file of files) {
      const dataset = JSON.parse(fs.readFileSync(path.join(TRENDS_DIR, file), 'utf8'));
      const { startDate, endDate } = rangeFromLabel(dataset.label);
      for (const trend of dataset.trends || []) {
        for (const evidence of trend.evidence || []) {
          if (!evidence.date || evidence.date < startDate || evidence.date > endDate) {
            violations.push(`${file}:${trend.id}:${evidence.date}:${evidence.title}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
