import { renderSparkline, formatDelta, describeTrend } from './vendor/mock_chart.js';

const EXPERIMENTS = [
  {
    id: 'predictive-referrals',
    title: 'Predictive Referrals',
    description: 'Scores partner activity to forecast who will send the next referral before the sprint closes.',
    baseline: 12.4,
    current: 15.6,
    units: 'leads/week',
    series: [9.2, 10.1, 11.4, 12.8, 13.7, 14.2, 15.6],
    status: 'Improving',
    summary: {
      improving: 'Projection beat the control cohort by 23% across the last sprint.',
      regressing: 'Lift dipped under the control line; keep experiments in manual review.',
      flat: 'Holding even with the control cohort; monitor for an additional week.'
    },
    nextSteps: [
      'Compare forecasts against closed-loan reality for the next 30 days.',
      'Backfill scoring attributes for legacy partners to improve accuracy.'
    ]
  },
  {
    id: 'retention-health',
    title: 'Client Retention Health',
    description: 'Creates a composite score from task cadence, unread outreach, and partner touchpoints.',
    baseline: 68,
    current: 74,
    units: 'index pts',
    series: [60, 64, 63, 66, 68, 71, 74],
    status: 'Improving',
    summary: {
      improving: 'Improved by 8.8% after adding partner engagement inputs.',
      regressing: 'Score fell below target; restore original weighting.',
      flat: 'Score matched the prior sprint; ship additional alerts before launch.'
    },
    nextSteps: [
      'Wire retention alerts into the notifications center.',
      'Pilot the score with three beta teams for qualitative feedback.'
    ]
  },
  {
    id: 'ai-drafting',
    title: 'AI Drafting Coach',
    description: 'Suggests next-touch messaging for warm leads using approved tone and disclosures.',
    baseline: 41,
    current: 38,
    units: 'mins saved',
    series: [44, 43, 41, 40, 39, 38],
    status: 'Needs tuning',
    summary: {
      improving: 'Drafting time is edging down; expand to the full partner set.',
      regressing: 'Time savings dropped below baseline—pause rollout pending prompt updates.',
      flat: 'Holding steady; gather more examples before the next iteration.'
    },
    nextSteps: [
      'Refresh the training set with new compliance-reviewed snippets.',
      'Benchmark drafts against human-written outreach for conversion impact.'
    ]
  }
];

const FEATURE_FLAGS = [
  { id: 'labs-partner-graph', label: 'Partner Graph Insights', state: 'enabled', note: 'Feeds dashboard heatmaps.' },
  { id: 'labs-intent-webhooks', label: 'Intent Webhooks', state: 'beta', note: 'Mirrors to the automation service.' },
  { id: 'labs-summarizer', label: 'Call Summary Drafts', state: 'research', note: 'Requires manual QA before general release.' }
];

const CHANGELOG = [
  { date: '2025-01-06', summary: 'Added retention health composite to the Labs workspace.' },
  { date: '2024-12-18', summary: 'Refined partner forecasting model with partner churn attributes.' },
  { date: '2024-12-04', summary: 'Bootstrapped Labs route with experimental widget shell.' }
];

function numberFormatter(){
  if(typeof Intl !== 'undefined' && Intl.NumberFormat){
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return { format: (value) => String(Math.round(value * 10) / 10) };
}

const metricFormatter = numberFormatter();

function formatMetric(value, units){
  return `${metricFormatter.format(value)} ${units}`;
}

function buildMetricRow(experiment){
  const wrapper = document.createElement('div');
  wrapper.className = 'row';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '12px';
  wrapper.dataset.qa = 'labs-experiment-metrics';

  const metric = document.createElement('strong');
  metric.dataset.qa = 'labs-experiment-metric';
  metric.textContent = formatMetric(experiment.current, experiment.units);
  wrapper.appendChild(metric);

  const baseline = document.createElement('span');
  baseline.className = 'muted';
  baseline.dataset.qa = 'labs-experiment-baseline';
  baseline.textContent = `Baseline: ${formatMetric(experiment.baseline, experiment.units)}`;
  wrapper.appendChild(baseline);

  const deltaInfo = formatDelta(experiment.current, experiment.baseline);
  const delta = document.createElement('span');
  delta.dataset.qa = 'labs-experiment-delta';
  delta.textContent = `${deltaInfo.label} vs baseline`;
  delta.className = 'muted';
  delta.style.color = deltaInfo.direction === 'up' ? 'var(--success, #047857)' : deltaInfo.direction === 'down' ? 'var(--danger, #b91c1c)' : 'var(--ink-400, #475569)';
  wrapper.appendChild(delta);

  return wrapper;
}

function buildNextStepsList(steps){
  if(!Array.isArray(steps) || steps.length === 0) return null;
  const title = document.createElement('h4');
  title.dataset.qa = 'labs-experiment-next-steps-title';
  title.style.margin = '16px 0 6px';
  title.textContent = 'Next steps';

  const list = document.createElement('ul');
  list.dataset.qa = 'labs-experiment-next-steps';
  list.style.paddingLeft = '18px';
  steps.forEach((step, index) => {
    const item = document.createElement('li');
    item.dataset.qa = `labs-experiment-next-step-${index + 1}`;
    item.textContent = step;
    list.appendChild(item);
  });

  const fragment = document.createDocumentFragment();
  fragment.appendChild(title);
  fragment.appendChild(list);
  return fragment;
}

function buildExperimentCard(experiment){
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.qa = `labs-experiment-${experiment.id}`;

  const header = document.createElement('div');
  header.className = 'row';
  header.style.alignItems = 'center';
  header.style.gap = '8px';
  header.dataset.qa = 'labs-experiment-header';

  const title = document.createElement('h3');
  title.dataset.qa = 'labs-experiment-title';
  title.style.margin = '0';
  title.textContent = experiment.title;
  header.appendChild(title);

  const spacer = document.createElement('span');
  spacer.className = 'grow';
  header.appendChild(spacer);

  const status = document.createElement('span');
  status.className = 'badge-pill';
  status.dataset.qa = 'labs-experiment-status';
  status.textContent = experiment.status;
  header.appendChild(status);

  card.appendChild(header);

  const description = document.createElement('p');
  description.className = 'muted';
  description.dataset.qa = 'labs-experiment-description';
  description.textContent = experiment.description;
  card.appendChild(description);

  card.appendChild(buildMetricRow(experiment));

  const sparklineHost = document.createElement('div');
  sparklineHost.dataset.qa = `labs-sparkline-${experiment.id}`;
  sparklineHost.style.marginTop = '12px';
  renderSparkline(sparklineHost, experiment.series, {
    baseline: experiment.baseline,
    label: `${experiment.title} performance trend`,
    qa: `labs-sparkline-${experiment.id}`
  });
  card.appendChild(sparklineHost);

  const insight = document.createElement('p');
  insight.className = 'muted';
  insight.dataset.qa = 'labs-experiment-insight';
  const trend = describeTrend(experiment.series);
  insight.textContent = experiment.summary[trend] || experiment.summary.improving;
  card.appendChild(insight);

  const nextSteps = buildNextStepsList(experiment.nextSteps);
  if(nextSteps){
    card.appendChild(nextSteps);
  }

  return card;
}

function buildFeatureFlags(){
  const section = document.createElement('section');
  section.dataset.qa = 'labs-flags';

  const title = document.createElement('h4');
  title.style.margin = '0 0 6px';
  title.textContent = 'Feature toggles';
  title.dataset.qa = 'labs-flags-title';
  section.appendChild(title);

  const list = document.createElement('ul');
  list.style.paddingLeft = '18px';
  list.dataset.qa = 'labs-flags-list';

  FEATURE_FLAGS.forEach((flag, index) => {
    const item = document.createElement('li');
    item.dataset.qa = `labs-flag-${flag.id}`;

    const label = document.createElement('div');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';

    const pill = document.createElement('span');
    pill.className = 'badge-pill';
    pill.dataset.qa = `labs-flag-state-${index + 1}`;
    pill.textContent = flag.state;

    const text = document.createElement('span');
    text.textContent = flag.label;
    text.dataset.qa = `labs-flag-label-${index + 1}`;

    label.appendChild(pill);
    label.appendChild(text);

    const note = document.createElement('p');
    note.className = 'muted';
    note.style.margin = '4px 0 0';
    note.dataset.qa = `labs-flag-note-${index + 1}`;
    note.textContent = flag.note;

    item.appendChild(label);
    item.appendChild(note);
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

function buildChangelog(){
  const section = document.createElement('section');
  section.dataset.qa = 'labs-changelog';
  section.style.marginTop = '16px';

  const title = document.createElement('h4');
  title.dataset.qa = 'labs-changelog-title';
  title.style.margin = '0 0 6px';
  title.textContent = 'Recent updates';
  section.appendChild(title);

  const list = document.createElement('ul');
  list.dataset.qa = 'labs-changelog-list';
  list.style.paddingLeft = '18px';

  CHANGELOG.forEach((entry, index) => {
    const item = document.createElement('li');
    item.dataset.qa = `labs-changelog-item-${index + 1}`;
    const strong = document.createElement('strong');
    strong.textContent = entry.date;
    strong.style.marginRight = '6px';
    const text = document.createElement('span');
    text.textContent = entry.summary;
    item.appendChild(strong);
    item.appendChild(text);
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

export function initLabsView(root){
  if(!root) return;
  root.innerHTML = '';
  root.classList.add('labs-surface');
  root.dataset.qa = root.dataset.qa || 'labs-root';

  const header = document.createElement('header');
  header.className = 'row';
  header.dataset.qa = 'labs-header';
  header.style.alignItems = 'baseline';
  header.style.gap = '12px';

  const title = document.createElement('h2');
  title.style.margin = '0';
  title.dataset.qa = 'labs-title';
  title.textContent = 'Labs';
  header.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.style.margin = '0';
  subtitle.dataset.qa = 'labs-subtitle';
  subtitle.textContent = 'Experimental widgets load here without slowing the primary dashboard.';
  header.appendChild(subtitle);

  root.appendChild(header);

  const layout = document.createElement('div');
  layout.className = 'row';
  layout.dataset.qa = 'labs-layout';
  layout.style.gap = '16px';
  layout.style.alignItems = 'stretch';
  layout.style.flexWrap = 'wrap';

  const experimentsSection = document.createElement('section');
  experimentsSection.className = 'grid cols-2';
  experimentsSection.dataset.qa = 'labs-experiments';
  experimentsSection.style.flex = '1 1 520px';
  experimentsSection.style.gap = '16px';

  EXPERIMENTS.forEach((experiment) => {
    experimentsSection.appendChild(buildExperimentCard(experiment));
  });

  const sidebar = document.createElement('aside');
  sidebar.className = 'card';
  sidebar.dataset.qa = 'labs-sidebar';
  sidebar.style.flex = '1 1 260px';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  sidebar.style.gap = '12px';

  const sidebarTitle = document.createElement('h3');
  sidebarTitle.dataset.qa = 'labs-sidebar-title';
  sidebarTitle.style.margin = '0';
  sidebarTitle.textContent = 'Launch checklist';
  sidebar.appendChild(sidebarTitle);

  const sidebarIntro = document.createElement('p');
  sidebarIntro.className = 'muted';
  sidebarIntro.dataset.qa = 'labs-sidebar-intro';
  sidebarIntro.textContent = 'Track which experiments are gated behind feature flags and the latest iteration notes.';
  sidebar.appendChild(sidebarIntro);

  sidebar.appendChild(buildFeatureFlags());
  sidebar.appendChild(buildChangelog());

  layout.appendChild(experimentsSection);
  layout.appendChild(sidebar);

  root.appendChild(layout);

  return root;
}

export default initLabsView;
