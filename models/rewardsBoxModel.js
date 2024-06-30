import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RewardsBox = sequelize.define('rewardsbox', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  clase: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  paquete: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  premio: {
    type: DataTypes.INTEGER(11),
    allowNull: true
  },
  tipo: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  multiple: {
    type: DataTypes.TINYINT(4),
    allowNull: false
  },
  options: {
    type: DataTypes.TEXT('medium'),
    allowNull: true
  },
  game: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  }
}, {
  tableName: 'rewardsbox',
  timestamps: false
});

export default RewardsBox;
