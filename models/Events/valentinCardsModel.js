import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ValentinCards = sequelize.define('valentincards', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  prize: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'valentincards',
  timestamps: false
});

export default ValentinCards;
