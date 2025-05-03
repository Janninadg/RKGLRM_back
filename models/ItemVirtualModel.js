import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemVirtual = sequelize.define('itemvirtual', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.TEXT('utf8mb4'),
    allowNull: false
  },
  itemref: {
    type: DataTypes.INTEGER(11),
    allowNull: true
  },
  cantidad: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  img: {
    type: DataTypes.TEXT('utf8mb4'),
    allowNull: false
  }
}, {
  tableName: 'itemvirtual',
  timestamps: false
});

export default ItemVirtual;
