import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UsersPanel = sequelize.define('userspanel', {
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
  password: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  type: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      isIn: [[0, 1]], // Ensure that the value is either 0 or 1
    },
    comment: '0: admin, 1: streamer',
  },
  ban: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0,
  },
  asociado: {
    type: DataTypes.STRING(11),
    allowNull: true, // Cambiado a true para permitir valores nulos
  },
  ultimaconexion: {
    type: DataTypes.DATE,
    allowNull: true, // Cambiado a true para permitir valores nulos
    defaultValue: sequelize.literal('current_timestamp()'), // Valor por defecto usando sequelize.literal
  },
}, {
  tableName: 'userspanel',
  timestamps: false,
});

export default UsersPanel;
