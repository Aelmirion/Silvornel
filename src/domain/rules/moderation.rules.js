'use strict';

const { DomainError } = require('../../core/errors/DomainError');

const WARNING_REASON_MAX_LENGTH = 500;
const WARNING_THRESHOLD_RULES = Object.freeze([
  Object.freeze({
    warningCount: 3,
    action: 'mute_placeholder',
    reason: 'Warning threshold reached (3 warnings)'
  })
]);

function validateWarningReason(reason) {
  if (typeof reason !== 'string') {
    throw new DomainError('Warning reason must be a string', 'WARNING_INVALID_REASON');
  }

  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw new DomainError('Warning reason cannot be empty', 'WARNING_EMPTY_REASON');
  }

  if (normalizedReason.length > WARNING_REASON_MAX_LENGTH) {
    throw new DomainError('Warning reason exceeds max length', 'WARNING_REASON_TOO_LONG');
  }

  return normalizedReason;
}

function evaluateModerationActionByWarnings(warningCount) {
  if (!Number.isInteger(warningCount) || warningCount < 0) {
    throw new DomainError('Warning count must be a non-negative integer', 'WARNING_INVALID_COUNT');
  }

  const matchingRules = WARNING_THRESHOLD_RULES
    .filter((rule) => warningCount >= rule.warningCount)
    .sort((left, right) => right.warningCount - left.warningCount);

  return matchingRules[0] || null;
}

module.exports = {
  WARNING_REASON_MAX_LENGTH,
  WARNING_THRESHOLD_RULES,
  validateWarningReason,
  evaluateModerationActionByWarnings
};
