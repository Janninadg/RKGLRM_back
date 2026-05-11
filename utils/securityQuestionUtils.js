import crypto from 'crypto';
import SecurityQuestion from '../models/securityQuestionModel.js';
import UserSecurityAnswer from '../models/userSecurityAnswerModel.js';

const SECURITY_ANSWER_REGEX = /^[A-Za-z0-9 ]+$/;

export function normalizeSecurityAnswer(answer) {
  return String(answer || '')
    .trim()
    .replace(/ {2,}/g, ' ')
    .toLowerCase();
}

export function validateSecurityAnswerFormat(answer) {
  const rawValue = String(answer || '').trim();

  if (rawValue.length < 3) {
    return {
      valid: false,
      normalized: normalizeSecurityAnswer(rawValue),
      message: 'La respuesta debe tener minimo 3 caracteres',
    };
  }

  if (rawValue.length > 20) {
    return {
      valid: false,
      normalized: normalizeSecurityAnswer(rawValue),
      message: 'La respuesta debe tener máximo 20 caracteres',
    };
  }

  if (!/[A-Za-z0-9]/.test(rawValue)) {
    return {
      valid: false,
      normalized: normalizeSecurityAnswer(rawValue),
      message: 'La respuesta no puede contener solo espacios',
    };
  }

  if (!SECURITY_ANSWER_REGEX.test(rawValue)) {
    return {
      valid: false,
      normalized: normalizeSecurityAnswer(rawValue),
      message: 'La respuesta solo puede contener letras, numeros y espacios',
    };
  }

  const normalized = normalizeSecurityAnswer(rawValue);

  return {
    valid: true,
    normalized,
    message: '',
  };
}

export function hashSecurityAnswer(answer) {
  const normalized = normalizeSecurityAnswer(answer);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function compareSecurityAnswer(answerHash, answer) {
  const incomingHash = hashSecurityAnswer(answer);
  const stored = Buffer.from(String(answerHash || ''), 'hex');
  const incoming = Buffer.from(incomingHash, 'hex');

  if (stored.length !== incoming.length) {
    return false;
  }

  return crypto.timingSafeEqual(stored, incoming);
}

export async function validateUserSecurityAnswer(user, answer, transaction = null) {
  const answerValidation = validateSecurityAnswerFormat(answer);

  if (!answerValidation.valid) {
    return {
      ok: false,
      code: '407',
      message: answerValidation.message,
    };
  }

  const securityAnswer = await UserSecurityAnswer.findOne({
    where: { user },
    transaction,
  });

  if (!securityAnswer) {
    return {
      ok: false,
      code: '405',
      message: 'Debes crear tu pregunta de seguridad antes de continuar',
    };
  }

  const question = await SecurityQuestion.findOne({
    where: {
      id: securityAnswer.question_id,
      active: 1,
    },
    transaction,
  });

  if (!question) {
    return {
      ok: false,
      code: '404',
      message: 'La pregunta de seguridad no esta disponible',
    };
  }

  if (!compareSecurityAnswer(securityAnswer.answer_hash, answerValidation.normalized)) {
    return {
      ok: false,
      code: '406',
      message: 'La respuesta de seguridad es incorrecta',
    };
  }

  return {
    ok: true,
    question,
  };
}
