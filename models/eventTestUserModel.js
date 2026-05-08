import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const EventTestUser = sequelize.define('event_test_user', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  event: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.literal('current_timestamp()'),
  },
}, {
  tableName: 'event_test_users',
  timestamps: false,
});

export default EventTestUser;