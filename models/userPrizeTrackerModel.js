import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserPrizeTracker = sequelize.define('user_prize_tracker', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  prize: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  tries: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  spent: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.literal('current_timestamp()'),
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.literal('current_timestamp()'),
  },
}, {
  tableName: 'user_prize_tracker',
  timestamps: true,
});

export default UserPrizeTracker;