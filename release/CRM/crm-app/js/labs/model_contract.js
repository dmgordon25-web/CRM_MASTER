// Labs Model Contract
// Defines canonical Labs model shape, normalization, and soft validation utilities.

import { canonicalStageKey } from '../workflow/state_model.js';
import { stageLabelFromKey } from '../pipeline/stages.js';

/**
 * @typedef {Object} LabsContact
 * @property {string} id
 * @property {string} [displayName]
 * @property {string} [name]
 * @property {string} [stage]
 * @property {number} [loanAmount]
 * @property {number} [updatedTs]
 */

/**
 * @typedef {Object} LabsPartner
 * @property {string} id
 * @property {string} [name]
 * @property {string} [displayName]
 */

/**
 * @typedef {Object} LabsTask
 * @property {string} id
 * @property {string} [title]
 * @property {string} [contactId]
 * @property {boolean} [completed]
 */

/**
 * @typedef {Object} LabsPipelineItem
 * @property {string} [id]
 * @property {string} [contactId]
 * @property {string} [partnerId]
 * @property {string} [borrowerName]
 * @property {string} [partnerName]
 * @property {string} [stage]
 * @property {string} [stageLabel]
 */

/**
 * @typedef {Object} LabsAnalytics
 * @property {Array} [funnel]
 * @property {Array} [velocityBuckets]
 * @property {Array} [staleSummary]
 * @property {Object} [riskSummary]
 */

/**
 * @typedef {Object} LabsModel
 * @property {LabsContact[]} contacts
 * @property {LabsPartner[]} partners
 * @property {LabsTask[]} tasks
 * @property {Object.<string, LabsContact>} contactsById
 * @property {Object.<string, LabsPartner>} partnersById
 * @property {Object.<string, LabsTask>} [tasksById]
 * @property {LabsPipelineItem[]} pipeline
 * @property {LabsPipelineItem[]} [activePipeline]
 * @property {LabsAnalytics} analytics
 * @property {(id: string) => string} getContactDisplayName
 * @property {(id: string) => string} getPartnerDisplayName
 * @property {(loan: LabsPipelineItem) => LabsPipelineItem} getLoanDisplay
 */

function buildMapById(list = [], key = 'id') {
  return Array.isArray(list)
    ? list.reduce((acc, item) => {
      const id = item?.[key];
      if (id && !acc[id]) acc[id] = item;
      return acc;
    }, {})
    : {};
}

function safeContactName(contact = {}) {
  const fallback = [
    contact.name,
    contact.fullName,
    contact.displayName,
    contact.contactName,
    contact.borrowerName,
    contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : null,
    contact.firstName,
    contact.lastName
  ].find((value) => value && String(value).trim());
  return fallback ? String(fallback).trim() : null;
}

function safePartnerName(partner = {}) {
  const fallback = [partner.name, partner.displayName, partner.company, partner.fullName].find(
    (value) => value && String(value).trim()
  );
  return fallback ? String(fallback).trim() : null;
}

function fallbackStageLabel(stageKey) {
  const normalizedStage = canonicalStageKey(stageKey);
  return stageLabelFromKey(normalizedStage) || normalizedStage || 'Unknown stage';
}

/**
 * Normalize Labs model to ensure helpers, maps, and enriched pipeline fields exist.
 * @param {Partial<LabsModel>} rawModel
 * @returns {LabsModel}
 */
export function normalizeLabsModel(rawModel = {}) {
  const contacts = Array.isArray(rawModel.contacts) ? rawModel.contacts : [];
  const partners = Array.isArray(rawModel.partners) ? rawModel.partners : [];
  const tasks = Array.isArray(rawModel.tasks) ? rawModel.tasks : [];

  const contactsById = rawModel.contactsById || buildMapById(contacts);
  const partnersById = rawModel.partnersById || buildMapById(partners);
  const tasksById = rawModel.tasksById || buildMapById(tasks);

  const getContactDisplayName =
    typeof rawModel.getContactDisplayName === 'function'
      ? rawModel.getContactDisplayName
      : (contactId) => safeContactName(contactsById[contactId] || {});

  const getPartnerDisplayName =
    typeof rawModel.getPartnerDisplayName === 'function'
      ? rawModel.getPartnerDisplayName
      : (partnerId) => safePartnerName(partnersById[partnerId] || {});

  const getLoanDisplay =
    typeof rawModel.getLoanDisplay === 'function'
      ? rawModel.getLoanDisplay
      : (loan) => {
        if (!loan) return loan;
        const contactId = loan.contactId || loan.id || loan.borrowerId;
        const partnerId = loan.partnerId || loan.referralPartnerId;
        const borrowerName =
          loan.borrowerName || (contactId ? getContactDisplayName(contactId) : null);
        const partnerName = loan.partnerName || (partnerId ? getPartnerDisplayName(partnerId) : null);
        const stageLabel = loan.stageLabel || fallbackStageLabel(loan.stage || loan.lane || loan.stageId);
        const amountValue = Number(loan.amount ?? loan.loanAmount);
        const amount = Number.isFinite(amountValue) ? amountValue : 0;
        return {
          ...loan,
          borrowerName,
          partnerName: partnerName || null,
          stageLabel,
          amount,
          contactId,
          partnerId
        };
      };

  const pipelineSource = Array.isArray(rawModel.pipeline)
    ? rawModel.pipeline
    : Array.isArray(rawModel.activePipeline)
      ? rawModel.activePipeline
      : [];

  const pipeline = pipelineSource.map((loan) => getLoanDisplay(loan));

  const analytics = {
    funnel: rawModel.analytics?.funnel || [],
    velocityBuckets: rawModel.analytics?.velocityBuckets || [],
    staleSummary: rawModel.analytics?.staleSummary || [],
    riskSummary: rawModel.analytics?.riskSummary || {}
  };

  return {
    ...rawModel,
    contacts,
    partners,
    tasks,
    contactsById,
    partnersById,
    tasksById,
    getContactDisplayName,
    getPartnerDisplayName,
    getLoanDisplay,
    pipeline,
    activePipeline: rawModel.activePipeline || pipeline,
    analytics
  };
}

function warn(message, meta) {
  console.warn('[LABS][model-contract]', message, meta || '');
}

/**
 * Soft validation for Labs model. Logs warnings but does not throw.
 * @param {LabsModel} model
 * @param {{ debug?: boolean }} [opts]
 * @returns {string[]}
 */
export function validateLabsModel(model, opts = {}) {
  const warnings = [];
  const addWarning = (msg) => {
    warnings.push(msg);
    warn(msg);
  };

  if (!Array.isArray(model.contacts)) addWarning('contacts array missing');
  if (!Array.isArray(model.partners)) addWarning('partners array missing');
  if (!Array.isArray(model.tasks)) addWarning('tasks array missing');
  if (!Array.isArray(model.pipeline)) addWarning('pipeline array missing');

  if (!model.contactsById || typeof model.getContactDisplayName !== 'function') {
    addWarning('contact helpers missing (contactsById or getContactDisplayName)');
  }

  if (!model.partnersById || typeof model.getPartnerDisplayName !== 'function') {
    addWarning('partner helpers missing (partnersById or getPartnerDisplayName)');
  }

  if (typeof model.getLoanDisplay !== 'function') {
    addWarning('loan display helper missing');
  }

  const pipelineItems = Array.isArray(model.pipeline) ? model.pipeline : [];
  const missingBorrower = pipelineItems.filter((p) => !p?.borrowerName).length;
  if (missingBorrower) addWarning(`pipeline items missing borrowerName: ${missingBorrower}`);

  const missingStageLabel = pipelineItems.filter((p) => !p?.stageLabel).length;
  if (missingStageLabel) addWarning(`pipeline items missing stageLabel: ${missingStageLabel}`);

  if (!model.analytics || !Array.isArray(model.analytics.funnel)) {
    // addWarning('analytics.funnel missing or invalid'); // Too noisy for hotfix
  }
  if (!model.analytics || !Array.isArray(model.analytics.velocityBuckets)) {
    // addWarning('analytics.velocityBuckets missing or invalid');
  }
  if (!model.analytics || !Array.isArray(model.analytics.staleSummary)) {
    // addWarning('analytics.staleSummary missing or invalid');
  }
  if (!model.analytics || typeof model.analytics.riskSummary !== 'object') {
    // addWarning('analytics.riskSummary missing or invalid');
  }

  return opts.debug ? warnings : [];
}

