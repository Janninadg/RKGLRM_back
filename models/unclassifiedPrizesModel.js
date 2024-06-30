import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UnclassifiedPrizes = sequelize.define('unclassifiedprizes', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  prize: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  type: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  game: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  cantidad: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'unclassifiedprizes',
  timestamps: false
});

export default UnclassifiedPrizes;
