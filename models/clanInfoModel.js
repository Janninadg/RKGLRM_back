import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const ClanInfo = sequelize.define('claninfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  mastername: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING(12),
    allowNull: true,
  },
  point: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  members: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
  rank: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    unsigned: true, // Solo aplica para MySQL
  },
  createtime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  country: {
    type: DataTypes.SMALLINT,
    allowNull: true,
  },
}, {
  tableName: 'claninfo',
  timestamps: false,
});

export default ClanInfo;
