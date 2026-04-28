import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CharacterInfoLog = sequelize.define('characterinfo_log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  player_name: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  account_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  total_sum: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  prevcash: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  actualcash: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'characterinfo_log',
  timestamps: false,
});

export default CharacterInfoLog;