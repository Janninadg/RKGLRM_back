import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TempPrize = sequelize.define('temp_prize', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  prize: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  type: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
    comment: '0: item, 1: oro, 2:cash, 3: tickets, 4: exp'
  },
  game: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  opcion: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'temp_prizes',
  timestamps: false
});

export default TempPrize;
