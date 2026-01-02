// crm-app/js/pipeline/stages.js
export const PIPELINE_STAGES = [
  "Long Shot",
  "Application",
  "Pre-Approved",
  "Processing",
  "Underwriting",
  "Approved",
  "CTC",
  "Funded",
];

const FALLBACK_STAGE = PIPELINE_STAGES[0];

const SYNONYMS = [
  ["Lead", "Long Shot"],
  ["Leads", "Long Shot"],
  ["Prospect", "Long Shot"],
  ["New Lead", "Long Shot"],
  ["Buyer Lead", "Long Shot"],
  ["LongShot", "Long Shot"],
  ["Long-Shot", "Long Shot"],
  ["PreApproved", "Pre-Approved"],
  ["Preapproved", "Pre-Approved"],
  ["Pre Approved", "Pre-Approved"],
  ["Pre-Approved", "Pre-Approved"],
  ["Pre App", "Pre-Approved"],
  ["Pre-App", "Pre-Approved"],
  ["Preapp", "Pre-Approved"],
  ["Pre Application", "Pre-Approved"],
  ["Pre-Application", "Pre-Approved"],
  ["Preapproval", "Pre-Approved"],
  ["Pre-Approval", "Pre-Approved"],
  ["UW", "Underwriting"],
  ["Under-write", "Underwriting"],
  ["Underwrite", "Underwriting"],
  ["Under Writing", "Underwriting"],
  ["Application Started", "Application"],
  ["App Started", "Application"],
  ["Nurture", "Application"],
  ["Clear to Close", "CTC"],
  ["Clear-To-Close", "CTC"],
  ["Clear-to-Close", "CTC"],
  ["Clear 2 Close", "CTC"],
  ["Clear2Close", "CTC"],
  ["Funded/Closed", "Funded"],
  ["Closed", "Funded"],
  ["Clients", "Funded"],
  ["Client", "Funded"],
  ["Past Client", "Funded"],
  ["Past Clients", "Funded"],
  ["Post Close", "Funded"],
  ["Post-Close", "Funded"],
];

function stageKeyFromNormalizedLabel(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return "long-shot";
  const lowered = raw.toLowerCase();
  if (lowered === "pre-approved" || lowered === "pre approved") return "preapproved";
  if (lowered === "ctc") return "cleared-to-close";
  if (lowered === "clear_to_close" || lowered === "clear-to-close" || lowered === "clear to close") {
    return "cleared-to-close";
  }
  if (lowered === "cleared-to-close" || lowered === "cleared to close" || lowered === "cleared_to_close") {
    return "cleared-to-close";
  }
  return lowered
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "long-shot";
}

const KEY_TO_LABEL = new Map();
PIPELINE_STAGES.forEach((label) => {
  const stageKey = stageKeyFromNormalizedLabel(label);
  const dashed = stageKey.replace(/_/g, "-");
  const underscored = stageKey.replace(/-/g, "_");
  KEY_TO_LABEL.set(stageKey, label);
  KEY_TO_LABEL.set(dashed, label);
  KEY_TO_LABEL.set(underscored, label);
  KEY_TO_LABEL.set(stageKeyFromNormalizedLabel(label), label);
});

let STAGE_KEY_ALIASES;
// Lazily allocate the alias map to avoid TDZ/circular-init faults when helpers
// call into it during module load. The getter ensures the map exists before use
// without moving call sites or changing behavior.
function getStageAliases() {
  if (!STAGE_KEY_ALIASES) STAGE_KEY_ALIASES = new Map();
  return STAGE_KEY_ALIASES;
}

function register(map, key, value) {
  if (!key) return;
  const variants = new Set([
    key,
    key.toLowerCase(),
    key.toUpperCase(),
    key.replace(/\s+/g, ""),
    key.toLowerCase().replace(/\s+/g, ""),
    key.replace(/[^a-z0-9]/gi, ""),
    key.toLowerCase().replace(/[^a-z0-9]/g, ""),
  ]);
  variants.forEach((token) => {
    if (token) map.set(token, value);
  });
}

function registerKeyAlias(input, key) {
  const raw = String(input ?? "").trim();
  if (!raw) return;
  const lowered = raw.toLowerCase();
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const squished = lowered.replace(/[^a-z0-9]+/g, "");
  const aliases = getStageAliases();
  [lowered, dashed, squished].forEach((token) => {
    if (token) aliases.set(token, key);
  });
}

export const NORMALIZE_STAGE = (function () {
  const map = new Map();
  PIPELINE_STAGES.forEach((stage) => register(map, stage, stage));
  SYNONYMS.forEach(([input, output]) => register(map, String(input ?? ""), output));
  PIPELINE_STAGES.forEach((stage) => {
    const key = stageKeyFromNormalizedLabel(stage);
    // Allow canonical keys to normalize back to display labels for DnD lanes
    register(map, key, stage);
    register(map, key.replace(/-/g, "_"), stage);
  });
  register(map, 'clear_to_close', 'CTC');
  register(map, 'clear-to-close', 'CTC');

  return function normalize(value) {
    if (!value) return FALLBACK_STAGE;
    const raw = String(value).trim();
    if (!raw) return FALLBACK_STAGE;
    const direct =
      map.get(raw) ||
      map.get(raw.toLowerCase()) ||
      map.get(raw.replace(/\s+/g, "")) ||
      map.get(raw.toLowerCase().replace(/\s+/g, "")) ||
      map.get(raw.replace(/[^a-z0-9]/gi, "")) ||
      map.get(raw.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (direct && PIPELINE_STAGES.includes(direct)) return direct;
    const lowered = raw.toLowerCase();
    const labelMatch = PIPELINE_STAGES.find((stage) => stage.toLowerCase() === lowered);
    if (labelMatch) return labelMatch;
    return FALLBACK_STAGE;
  };
})();

PIPELINE_STAGES.forEach((stage) => registerKeyAlias(stage, stageKeyFromNormalizedLabel(stage)));
SYNONYMS.forEach(([input, output]) => registerKeyAlias(input, stageKeyFromNormalizedLabel(output)));
registerKeyAlias("application-started", stageKeyFromNormalizedLabel("Application"));
registerKeyAlias("nurture", stageKeyFromNormalizedLabel("Application"));
registerKeyAlias("buyer-lead", stageKeyFromNormalizedLabel("Long Shot"));
registerKeyAlias("lost", "lost");
registerKeyAlias("denied", "denied");

export function stageKeyFromLabel(label) {
  const raw = String(label ?? "").trim();
  if (!raw) return stageKeyFromNormalizedLabel(FALLBACK_STAGE);
  const lowered = raw.toLowerCase();
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const squished = lowered.replace(/[^a-z0-9]+/g, "");
  const aliases = getStageAliases();
  if (aliases.has(lowered)) return aliases.get(lowered);
  if (aliases.has(dashed)) return aliases.get(dashed);
  if (aliases.has(squished)) return aliases.get(squished);
  if (lowered === "lost" || lowered === "denied") return lowered;
  const normalized = NORMALIZE_STAGE(raw);
  return stageKeyFromNormalizedLabel(normalized);
}

export function stageLabelFromKey(key) {
  const normalizedKey = String(key ?? "").trim().toLowerCase();
  if (KEY_TO_LABEL.has(normalizedKey)) return KEY_TO_LABEL.get(normalizedKey);
  const normalizedStage = NORMALIZE_STAGE(key);
  const derived = stageKeyFromNormalizedLabel(normalizedStage);
  return KEY_TO_LABEL.get(derived) || normalizedStage || FALLBACK_STAGE;
}

export const PIPELINE_STAGE_KEYS = PIPELINE_STAGES.map(stageKeyFromNormalizedLabel);
