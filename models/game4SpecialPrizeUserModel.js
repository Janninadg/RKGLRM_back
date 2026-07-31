import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Game4SpecialPrizeUser = sequelize.define('game4specialprizeuser', {
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
  active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
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
  tableName: 'game4specialprizeusers',
  timestamps: false,
});

export default Game4SpecialPrizeUser;
