import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const GameActive = sequelize.define('gameactive', {
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    primaryKey: true
  },
  active: {
    type: DataTypes.TINYINT(4),
    allowNull: false,
    defaultValue: 0,
    comment: '0: no activo, 1: dentro del juego'
  }
}, {
  tableName: 'gameactive',
  timestamps: false
});

export default GameActive;
