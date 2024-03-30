import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TrackingPacket = sequelize.define('trackingpacket', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  packet: {
    type: DataTypes.TEXT('medium'),
    collate: 'utf8mb4_general_ci',
    allowNull: false,
  },
  user: {
    type: DataTypes.STRING(11),
    collate: 'utf8mb4_general_ci',
    allowNull: false,
  },
  fecha_uso: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'trackingpacket',
  timestamps: false,
});

export default TrackingPacket;