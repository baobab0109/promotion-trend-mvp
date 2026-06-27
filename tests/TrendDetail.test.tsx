import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrendDetail from '../src/components/TrendDetail';
import { sampleTrends } from '../src/data/sampleTrends';

describe('TrendDetail evidence links', () => {
  it('lets 근거 링크 보기 navigate to the original evidence URL', () => {
    const trend = {
      ...sampleTrends[0],
      evidence: [
        {
          ...sampleTrends[0].evidence[0],
          url: 'https://example.com/original-evidence'
        }
      ]
    };

    render(<TrendDetail trend={trend} />);

    const link = screen.getByRole('link', { name: '근거 링크 보기' });
    expect(link).toHaveAttribute('href', 'https://example.com/original-evidence');

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
  });
});
