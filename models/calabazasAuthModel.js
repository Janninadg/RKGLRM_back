import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PumpkinsAuth = sequelize.define('calabazasauth', {
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
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'calabazasauth',
  timestamps: false
});

export default PumpkinsAuth;
