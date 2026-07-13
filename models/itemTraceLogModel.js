import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemTraceLog = sequelize.define('item_trace_logs', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  uniqueitemcode: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  origin_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  action_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  from_user: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  to_user: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  origin_ref_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  temp_useriteminfo_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  useriteminfo_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'item_trace_logs',
  timestamps: false,
});

export default ItemTraceLog;
