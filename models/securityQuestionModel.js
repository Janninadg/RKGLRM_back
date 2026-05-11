import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SecurityQuestion = sequelize.define('security_questions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  question: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
  },
}, {
  tableName: 'security_questions',
  timestamps: false,
});

export default SecurityQuestion;
