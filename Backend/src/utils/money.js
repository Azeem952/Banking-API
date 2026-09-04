const CURRENCY_CODES = Object.freeze({ NGN: 'NGN' });

function validateMoneyValue(value, { allowZero = false, allowNegative = false, fieldName = 'value' } = {}) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return false;
  }

  if (!Number.isSafeInteger(value)) {
    return false;
  }

  if (value === 0 && !allowZero) {
    return false;
  }

  if (value < 0 && !allowNegative) {
    return false;
  }

  if (value < 0 && allowNegative === false && fieldName) {
    return false;
  }

  return true;
}

function validateCurrency(currency) {
  return typeof currency === 'string' && Object.values(CURRENCY_CODES).includes(currency);
}

module.exports = {
  CURRENCY_CODES,
  validateMoneyValue,
  validateCurrency,
};
