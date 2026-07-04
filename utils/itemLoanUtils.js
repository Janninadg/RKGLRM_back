import crypto from 'crypto';

const padNumber = (value, size) => {
  const numberValue = Math.abs(Number(value) || 0);
  return String(numberValue).padStart(size, '0').slice(-size);
};

const padDate = (value, size = 2) => String(value).padStart(size, '0');

export const generateUniqueItemCode = ({ userId = 0, itemId = 0, date = new Date() } = {}) => {
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

  return `LN${stamp}${padNumber(userId, 6)}${padNumber(itemId, 6)}${randomPart}`;
};
