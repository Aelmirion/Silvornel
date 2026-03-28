'use strict';

const { AppError } = require('./AppError');

class DomainError extends AppError {
  constructor(message, code = 'DOMAIN_ERROR') {
    super(message, code);
    this.name = 'DomainError';
  }
}

module.exports = { DomainError };
