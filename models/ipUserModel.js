// models/InitialIpUser.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia Sequelize

const InitialIpUser = sequelize.define('InitialIpUser', {
  user: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
  },
  ip: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
}, {
  tableName: 'initialipuser',
  timestamps: false,
});

export default InitialIpUser;
