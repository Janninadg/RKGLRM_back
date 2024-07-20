import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemStore = sequelize.define('itemstore', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  stockLimit: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0
  },
  stock: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  userLimit: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0
  },
  maxUsers: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'itemstore',
  timestamps: false
});

export default ItemStore;
