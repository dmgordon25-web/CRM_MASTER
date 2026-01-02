import { PIPELINE_STAGE_KEYS, stageKeyFromLabel, stageLabelFromKey } from '../../pipeline/stages.js';

const PIPELINE_SNAPSHOT_STAGE_KEYS = PIPELINE_STAGE_KEYS.filter((key) => key !== 'funded');

function normalizePipelineStage(value) {
  const key = stageKeyFromLabel(value);
  if (PIPELINE_SNAPSHOT_STAGE_KEYS.includes(key)) return key;
  return '';
}

function tallyStageCounts(counts, sourceCounts) {
  Object.entries(sourceCounts || {}).forEach(([stage, count]) => {
    const key = normalizePipelineStage(stage);
    if (!key) return;
    const numeric = Number(count) || 0;
    counts[key] = (counts[key] || 0) + numeric;
  });
}

export function computePipelineSnapshot(model = {}) {
  const counts = {};
  PIPELINE_SNAPSHOT_STAGE_KEYS.forEach((key) => { counts[key] = 0; });

  const snapshotCounts = model?.snapshot?.pipelineCounts;
  if (snapshotCounts && Object.keys(snapshotCounts).length) {
    tallyStageCounts(counts, snapshotCounts);
  } else {
    (model?.contacts || []).forEach((contact) => {
      const key = normalizePipelineStage(contact?.lane || contact?.stage);
      if (!key) return;
      counts[key] += 1;
    });
  }

  const stages = PIPELINE_SNAPSHOT_STAGE_KEYS.map((key) => ({
    key,
    label: stageLabelFromKey(key),
    count: counts[key] || 0
  }));
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return { stages, counts, total };
}

export { PIPELINE_SNAPSHOT_STAGE_KEYS };
