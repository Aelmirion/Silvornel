'use strict';

const { AppError } = require('./AppError');

class InfraError extends AppError {
  constructor(message, code = 'INFRA_ERROR') {
    super(message, code);
    this.name = 'InfraError';
  }
}

module.exports = { InfraError };
