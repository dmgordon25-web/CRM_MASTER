import { describe, expect, it } from 'vitest';
import { computeWidgetVisibility, BASELINE_WIDGET_POLICY } from '../../crm-app/js/dashboard/baseline_snapshot.js';

describe('computeWidgetVisibility', () => {
  it('enables baseline widgets in today mode', () => {
    const visibility = computeWidgetVisibility('today', { kpis: true, pipeline: true, today: true });
    expect(visibility.today).toBe(true);
    expect(visibility.kpis).toBe(true);
    expect(visibility.pipeline).toBe(true);
    expect(visibility.leaderboard).toBe(false);
    expect(visibility.stale).toBe(false);
  });

  it('respects stored widget preferences', () => {
    const visibility = computeWidgetVisibility('today', { kpis: false, pipeline: true });
    expect(visibility.kpis).toBe(false);
    expect(visibility.pipeline).toBe(true);
  });

  it('shows all widgets allowed in all mode', () => {
    const visibility = computeWidgetVisibility('all', { leaderboard: true });
    Object.keys(BASELINE_WIDGET_POLICY).forEach((key) => {
      if (BASELINE_WIDGET_POLICY[key].all === false) {
        expect(visibility[key]).toBe(false);
      } else {
        expect(visibility[key]).not.toBe(false);
      }
    });
    expect(visibility.leaderboard).toBe(true);
  });
});
