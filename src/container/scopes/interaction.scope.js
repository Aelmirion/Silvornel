'use strict';

function createInteractionScope(rootContainer, context = {}) {
  return {
    resolve(token) {
      return rootContainer.resolve(token);
    },
    context
  };
}

module.exports = { createInteractionScope };
