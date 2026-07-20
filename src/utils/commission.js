export function computeCommission(faceAmount) {
  return Math.round(Number(faceAmount) * 0.01 * 100) / 100;
}

export function normalizeCommissionMode(mode) {
  const raw = String(mode || 'Deducted');
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (normalized === 'Deducted' || normalized === 'Cash' || normalized === 'Bank') {
    return normalized;
  }
  return 'Deducted';
}

export function computeCommissionAmounts(faceAmount, type, commissionMode) {
  const numAmount = Number(faceAmount);
  const comm = computeCommission(numAmount);
  const mode = normalizeCommissionMode(commissionMode);
  const txType = type === 'Debit' ? 'Debit' : 'Credit';

  let customerAmount = 0;
  let cashOut = 0;

  if (txType === 'Credit') {
    if (mode === 'Deducted') {
      customerAmount = numAmount;
      cashOut = numAmount - comm;
    } else if (mode === 'Cash') {
      customerAmount = numAmount;
      cashOut = numAmount - comm;
    } else {
      customerAmount = numAmount + comm;
      cashOut = numAmount;
    }
  } else if (mode === 'Deducted') {
    customerAmount = -(numAmount - comm);
    cashOut = -numAmount;
  } else if (mode === 'Cash') {
    customerAmount = -numAmount;
    cashOut = -(numAmount + comm);
  } else {
    customerAmount = -numAmount;
    cashOut = -numAmount;
  }

  return {
    customerAmount,
    cashOut,
    profit: comm,
    commissionMode: mode,
  };
}

export function getSufficiencyRequirements(faceAmount, type, commissionMode) {
  const { customerAmount, cashOut } = computeCommissionAmounts(faceAmount, type, commissionMode);
  const txType = type === 'Debit' ? 'Debit' : 'Credit';

  if (txType === 'Credit') {
    return {
      cashRequired: Math.max(0, cashOut),
      bankRequired: 0,
      customerAmount,
      cashOut,
    };
  }

  return {
    cashRequired: 0,
    bankRequired: Math.max(0, Math.abs(customerAmount)),
    customerAmount,
    cashOut,
  };
}

export function amountsMatch(expected, actual, tolerance = 0.01) {
  return (
    Math.abs(Number(expected.customerAmount) - Number(actual.customerAmount)) <= tolerance &&
    Math.abs(Number(expected.cashOut) - Number(actual.cashOut)) <= tolerance &&
    Math.abs(Number(expected.profit) - Number(actual.profit)) <= tolerance
  );
}
