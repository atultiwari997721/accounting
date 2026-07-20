const BUSINESS_TZ = 'Asia/Kolkata';

export function getBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isBeforeMidnightIST(date = new Date()) {
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  return timeStr !== '00:00:00';
}

export function canReopenLedger(ledgerDate, date = new Date()) {
  return ledgerDate === getBusinessDate(date) && isBeforeMidnightIST(date);
}
