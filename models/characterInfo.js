// models/CharacterInfo.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Importa tu instancia Sequelize

const CharacterInfo = sequelize.define('CharacterInfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  name: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  used: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  deletekey: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'sirmaster',
  },
  auth: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  Class: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  level: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  win: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  lose: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  draw: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  exp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  levelpoint: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  slot: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  hit1: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  hit2: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  hit3: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  hit4: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  chit: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  hp: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  ap: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  attackspeed: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  speed: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  maxcp: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  rankgrade: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  totalrank: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  classrank: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  potionslot: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 3,
  },
  changetime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
  createtime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00',
  },
}, {
    tableName: 'characterinfo', 
    timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default CharacterInfo;
