import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';  // Asegúrate de importar tu instancia de Sequelize

const UserGameInfo = sequelize.define('usergameinfo', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(11),
    allowNull: false,
    unique: true,
    collate: 'utf8_general_ci',
  },
  gold: {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  },
  tutorial: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  stagelevelfree: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  slot: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: 3,
  },
  bandate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
  clanid: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  clanpoint: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  clanrank: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  clangrade: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  buddyname: {
    type: DataTypes.STRING(30),
    collate: 'utf8_general_ci',
  },
  powertime: {
    type: DataTypes.BIGINT(11),
    allowNull: false,
    defaultValue: 0,
  },
  powerlevelpoint: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  powertimedate: {
    type: DataTypes.DATE,
    defaultValue: '0000-00-00 00:00:00',
  },
  ban: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  charname: {
    type: DataTypes.STRING(30),
    collate: 'utf8_general_ci',
  },
  treeuppername: {
    type: DataTypes.STRING(30),
    collate: 'utf8_general_ci',
  },
  treerank: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  bag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  rankgrade: {
    type: DataTypes.SMALLINT(6),
    allowNull: false,
    defaultValue: 0,
  },
  country: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 9,
  },
  lastconnect: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
  createtime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
  BanReason: {
    type: DataTypes.STRING(32),
    collate: 'utf8_general_ci',
    allowNull: true,
  },
},{
    tableName: 'usergameinfo', // Nombre de la tabla en la base de datos
    timestamps: false, // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default UserGameInfo;
