// models/user_credits.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const UserCredits = sequelize.define('user_credits', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    unique: true,
    collate: 'utf8mb4_general_ci',
  },
  credits: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW, // Sequelize no lo aplica solo, pero lo respetará en MySQL
  },
}, {
  tableName: 'user_credits',
  timestamps: false, // evitamos createdAt / updatedAt automáticos
});

export default UserCredits;
