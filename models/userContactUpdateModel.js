import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserContactUpdate = sequelize.define('user_contact_updates', {
  user: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
  },
  updated_number: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'user_contact_updates',
  timestamps: false,
});

export default UserContactUpdate;
