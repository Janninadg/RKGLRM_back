import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EventLevelCharacter = sequelize.define('eventlevelcharacter', {
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
  characterid: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  }
}, {
  tableName: 'eventlevelcharacter',
  timestamps: false
});

export default EventLevelCharacter;
