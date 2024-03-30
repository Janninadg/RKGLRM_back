import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypeEvents = sequelize.define('typeevents', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'typeevents',
  timestamps: false
});

export default TypeEvents;
