import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const GameAuth = sequelize.define('gameauth', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type_game: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'gameauth',
  timestamps: false
});

export default GameAuth;
