import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClanRequest = sequelize.define('clanrequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userid: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  clanid: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'clanrequest',
  timestamps: false,
});

export default ClanRequest;