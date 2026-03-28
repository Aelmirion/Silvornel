'use strict';

async function withTimeout(executor, timeoutMs, label = 'operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const taskPromise = typeof executor === 'function' ? executor() : executor;
    return await Promise.race([taskPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { withTimeout };
