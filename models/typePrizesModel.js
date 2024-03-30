import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypePrize = sequelize.define('typeprizes', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'typeprizes',
  timestamps: false
});

export default TypePrize;
