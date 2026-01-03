import { describe, it, expect } from 'vitest';
import { computePipelineSnapshot, PIPELINE_SNAPSHOT_STAGE_KEYS } from '../../crm-app/js/labs/helpers/pipeline_snapshot_logic.js';
import { PIPELINE_STAGE_KEYS } from '../../crm-app/js/pipeline/stages.js';

describe('Labs pipeline snapshot canonicalization', () => {
  it('matches the dashboard stage order without duplicates', () => {
    expect(PIPELINE_SNAPSHOT_STAGE_KEYS).toEqual(PIPELINE_STAGE_KEYS);
    expect(new Set(PIPELINE_SNAPSHOT_STAGE_KEYS).size).toBe(PIPELINE_SNAPSHOT_STAGE_KEYS.length);
  });

  it('normalizes aliases into canonical stages without surfacing extras', () => {
    const model = {
      snapshot: {
        pipelineCounts: {
          'Pre App': 3,
          CTC: 2,
          LongShot: 1,
          'Mystery Stage': 4,
          lost: 5
        }
      }
    };

    const { stages } = computePipelineSnapshot(model);
    const counts = Object.fromEntries(stages.map(({ key, count }) => [key, count]));

    expect(stages.map((stage) => stage.key)).toEqual(PIPELINE_STAGE_KEYS);
    expect(counts.preapproved).toBe(3);
    expect(counts['cleared-to-close']).toBe(2);
    expect(counts['long-shot']).toBe(5);
    expect(counts.lost).toBeUndefined();
  });
});
