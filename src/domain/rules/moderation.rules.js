'use strict';

const { DomainError } = require('../../core/errors/DomainError');

const WARNING_REASON_MAX_LENGTH = 500;

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

module.exports = {
  WARNING_REASON_MAX_LENGTH,
  validateWarningReason
};
