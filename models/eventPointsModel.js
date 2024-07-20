import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EventPoint = sequelize.define('usereventpoint', {
  User: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false
  },
  Points: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'usereventpoint',
  timestamps: false
});

export default EventPoint;
