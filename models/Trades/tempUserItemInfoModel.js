import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const TempUserItemInfo = sequelize.define('temp_useriteminfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  // marketid: {
  //   type: DataTypes.INTEGER,
  //   allowNull: false,
  //   defaultValue: 0,
  // },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  characterid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  itemid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  item_sn: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 8000,
  },
  sn_type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 3,
  },
  level: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  limittime: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  slot: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  exp: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  uniqueitemcode: {
    type: DataTypes.STRING(40),
    allowNull: true,
    defaultValue: null,
  },
  code_generated_on_publish: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  code_from_useriteminfo: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  istemporal: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  dias: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'temp_useriteminfo',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default TempUserItemInfo;
