import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemTraceAction = sequelize.define('item_trace_actions', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  origin_id: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  code: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  tipo: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },
  active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'item_trace_actions',
  timestamps: false,
});

export default ItemTraceAction;
