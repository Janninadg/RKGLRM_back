import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LogItemLoan = sequelize.define('log_item_loans', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  loan_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  gm_user: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING(30),
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
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'log_item_loans',
  timestamps: false,
});

export default LogItemLoan;
