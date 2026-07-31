import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Game4SpecialPrizeWin = sequelize.define('game4specialprizewin', {
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
  prizegame_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  wins: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  last_match_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  last_won_at: {
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
  tableName: 'game4specialprizewins',
  timestamps: false,
});

export default Game4SpecialPrizeWin;
