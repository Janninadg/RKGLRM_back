import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ItemTraceOrigin = sequelize.define('item_trace_origins', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  tipo: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },
  source_table: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'item_trace_origins',
  timestamps: false,
});

export default ItemTraceOrigin;
