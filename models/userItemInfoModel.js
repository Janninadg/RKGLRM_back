import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const UserItemInfo = sequelize.define('useriteminfo', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  userid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  characterid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  item_sn: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: '8000'
  },
  sn_type: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 3
  },
  level: {
    type: DataTypes.TINYINT(3),
    allowNull: false,
    defaultValue: 1
  },
  limittime: {
    type: DataTypes.INTEGER(11),
    allowNull: false
    // No se proporciona un valor predeterminado, ya que mencionaste "Ninguna"
  },
  slot: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 1
  },
  exp: {
    type: DataTypes.BIGINT(20),
    allowNull: false,
    defaultValue: 0
  },
  uniqueitemcode: {
    type: DataTypes.STRING(40),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'useriteminfo', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default UserItemInfo;
