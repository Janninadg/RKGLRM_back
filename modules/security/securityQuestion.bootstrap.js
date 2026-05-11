import sequelize from '../../config/database.js';
import SecurityQuestion from '../../models/securityQuestionModel.js';

const DEFAULT_SECURITY_QUESTIONS = [
  'Cual fue el nombre de tu primera mascota',
  'En que ciudad naciste',
  'Cual es tu comida favorita',
  'Cual fue el nombre de tu primer colegio',
  'Cual es el segundo nombre de tu madre',
  'Cual era tu apodo de infancia',
  'Cual fue tu primer juego favorito',
  'Cual es el nombre de tu mejor amigo de infancia',
];

export async function initSecurityQuestionTables() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS security_questions (
      id INT NOT NULL AUTO_INCREMENT,
      question VARCHAR(150) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY security_questions_question_unique (question)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS user_security_answers (
      id INT NOT NULL AUTO_INCREMENT,
      user VARCHAR(11) NOT NULL,
      question_id INT NOT NULL,
      answer_hash VARCHAR(64) NOT NULL,
      created_ip VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_security_answers_user_unique (user),
      KEY user_security_answers_question_id_idx (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  const totalQuestions = await SecurityQuestion.count();

  if (totalQuestions === 0) {
    await SecurityQuestion.bulkCreate(
      DEFAULT_SECURITY_QUESTIONS.map((question) => ({ question, active: 1 })),
      { ignoreDuplicates: true }
    );
  }
}

export default initSecurityQuestionTables;
