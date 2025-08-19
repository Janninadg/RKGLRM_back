import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WebUser = sequelize.define('webuser', {
  user: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '#FFFFFF',
  },
  photo: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'https://i.pravatar.cc/100?img=10',
  },
  role: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'webusers',
  timestamps: false,
});

export default WebUser;
