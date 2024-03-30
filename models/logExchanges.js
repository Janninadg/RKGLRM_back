import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LogExchange = sequelize.define('logexchanges', {
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
  cash: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  oro: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'logexchanges',
  timestamps: false,
});

export default LogExchange;
