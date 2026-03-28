'use strict';

function validateRequired(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
}

module.exports = { validateRequired };
