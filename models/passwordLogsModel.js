import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PasswordLogs = sequelize.define('password_logs', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  old_password: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  new_password: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  ip: {
    type: DataTypes.STRING(45),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
  },
}, {
  tableName: 'password_logs',
  timestamps: false,
});

export default PasswordLogs;