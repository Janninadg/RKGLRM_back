import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TicketsMode = sequelize.define('ticketsmode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  tickets: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '0: evento, 1:stages, etc',
  },
  mode: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'id de stage, ejm themepark: 71',
  },
}, {
  tableName: 'ticketsmode',
  timestamps: false,
});

export default TicketsMode;
