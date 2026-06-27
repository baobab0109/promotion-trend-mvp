import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PeriodSelector from '../src/components/PeriodSelector';
import type { PeriodControlModel } from '../src/domain/types';

const model: PeriodControlModel = {
  quickOptions: [
    { value: 'recent-7', label: '최근 7일', description: '7일' },
    { value: 'recent-14', label: '최근 14일', description: '14일' },
    { value: 'recent-30', label: '최근 30일', description: '30일' },
    { value: 'weekly', label: '주간', description: '주간 선택' }
  ],
  weeklyOptions: [
    { value: 'latest', label: '최신 완료주 · 2026.06.17 - 2026.06.23', description: '완료주', files: ['./data/trends/2026-W25.json'] },
    { value: 'recent-4w', label: '최근 4주 합산', description: '합산', files: ['./data/trends/2026-W25.json'] }
  ],
  defaultWeeklyValue: 'latest'
};

describe('PeriodSelector', () => {
  it('renders recommended period presets and hides weekly dropdown until weekly mode is active', () => {
    render(<PeriodSelector model={model} preset="recent-30" weeklyValue="latest" activeLabel="최근 30일" loading={false} onPresetChange={() => {}} onWeeklyValueChange={() => {}} />);

    expect(screen.getByRole('button', { name: /최근 7일/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /최근 14일/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /최근 30일/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /주간/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('주차 선택')).not.toBeInTheDocument();
  });

  it('shows weekly choices and emits selection changes in weekly mode', async () => {
    const onWeeklyValueChange = vi.fn();
    const user = userEvent.setup();
    render(<PeriodSelector model={model} preset="weekly" weeklyValue="latest" activeLabel="최신 완료주" loading={false} onPresetChange={() => {}} onWeeklyValueChange={onWeeklyValueChange} />);

    await user.selectOptions(screen.getByLabelText('주차 선택'), 'recent-4w');

    expect(onWeeklyValueChange).toHaveBeenCalledWith('recent-4w');
  });
});
