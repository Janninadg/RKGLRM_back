// models/ItemInfo.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia Sequelize

const ItemInfo = sequelize.define('ItemInfo', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  Class: {
    type: DataTypes.TINYINT(3),
    allowNull: false,
    defaultValue: 0,
  },
  level: {
    type: DataTypes.TINYINT(3),
    allowNull: false,
    defaultValue: 0,
  },
  shop: {
    type: DataTypes.TINYINT(3),
    allowNull: false,
    defaultValue: 0,
  },
  gold: {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  },
  cash: {
    type: DataTypes.INTEGER(10),
    allowNull: false,
    defaultValue: 0,
  },
  hit1: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  hit2: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  hit3: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  hit4: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  chit: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  ap: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  hp: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  maxcp: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
  power: {
    type: DataTypes.INTEGER(3),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'iteminfo',
  timestamps: false,
});

export default ItemInfo;
