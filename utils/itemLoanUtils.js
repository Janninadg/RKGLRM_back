import crypto from 'crypto';

const padNumber = (value, size) => {
  const numberValue = Math.abs(Number(value) || 0);
  return String(numberValue).padStart(size, '0').slice(-size);
};

const padDate = (value, size = 2) => String(value).padStart(size, '0');

const normalizePrefix = (value) => {
  const prefix = String(value || 'LN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 2);

  return prefix.padEnd(2, 'X');
};

const digitizeText = (value, size = 6) => {
  const cleanValue = String(value || '').trim().toLowerCase();

  if (!cleanValue) {
    return null;
  }

  const numericChars = cleanValue.replace(/\D/g, '');

  if (numericChars.length >= size) {
    return numericChars.slice(-size);
  }

  const hash = crypto.createHash('sha1').update(cleanValue).digest('hex');
  const numericHash = parseInt(hash.slice(0, 12), 16) % (10 ** size);

  return padNumber(numericHash, size);
};

export const generateUniqueItemCode = ({
  userId = 0,
  userName = '',
  itemId = 0,
  date = new Date(),
  prefix = 'LN',
} = {}) => {
  const stamp = [
    date.getFullYear(),
    padDate(date.getMonth() + 1),
    padDate(date.getDate()),
    padDate(date.getHours()),
    padDate(date.getMinutes()),
    padDate(date.getSeconds()),
    padDate(date.getMilliseconds(), 3),
  ].join('');

  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  const ownerDigits = digitizeText(userName) || padNumber(userId, 6);

  return `${normalizePrefix(prefix)}${stamp}${ownerDigits}${padNumber(itemId, 6)}${randomPart}`;
};
