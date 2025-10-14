import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PurchaseLogs = sequelize.define('pucharselogs', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(12),
    allowNull: false
  },
  idstore: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
   itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  pointsspent: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pucharselogs',
  timestamps: false
});

export default PurchaseLogs;
