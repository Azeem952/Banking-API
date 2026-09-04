const crypto = require('node:crypto');

function generateReference(prefix = 'TX') {
  return `${prefix}-${crypto.randomUUID()}`;
}

module.exports = generateReference;