import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserStageInfo = sequelize.define('userstageinfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  characterid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  stage: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  updatetime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
}, {
  tableName: 'userstageinfo',
  timestamps: false,
});

export default UserStageInfo;
