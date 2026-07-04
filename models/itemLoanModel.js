import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemLoan = sequelize.define('item_loans', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  userid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  useriteminfo_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  uniqueitemcode: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  status: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 1,
  },
  loaned_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'item_loans',
  timestamps: false,
});

export default ItemLoan;
