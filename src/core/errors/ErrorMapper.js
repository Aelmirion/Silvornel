'use strict';

const { AppError } = require('./AppError');
const { DomainError } = require('./DomainError');

class ErrorMapper {
  map(error) {
    if (error instanceof DomainError) {
      return error;
    }

    return new AppError('Unexpected error occurred', 'UNEXPECTED_ERROR');
  }
}

module.exports = { ErrorMapper };
