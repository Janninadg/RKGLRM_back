import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypeOrigenReward = sequelize.define('typeorigenreward', {
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
  tableName: 'typeorigenreward',
  timestamps: false
});

export default TypeOrigenReward;
