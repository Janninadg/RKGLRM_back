import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Game4SpendingTracker = sequelize.define('game4spendingtracker', {
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
  modalidad: {
    type: DataTypes.TINYINT,
    allowNull: false,
  },
  spent_amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  last_win_match_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  last_win_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'game4spendingtracker',
  timestamps: false,
});

export default Game4SpendingTracker;
