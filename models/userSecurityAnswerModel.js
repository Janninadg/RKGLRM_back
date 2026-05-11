import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserSecurityAnswer = sequelize.define('user_security_answers', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  answer_raw:{
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  answer_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  created_ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
  },
}, {
  tableName: 'user_security_answers',
  timestamps: false,
});

export default UserSecurityAnswer;
