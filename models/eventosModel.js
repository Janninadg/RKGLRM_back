import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Evento = sequelize.define('evento', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  imageUrl: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  inicio: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: sequelize.literal('current_timestamp()')
  },
  fin: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  mode: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 1,
    comment: '0: test, 1 game'
  },
  show: {
    type: DataTypes.TINYINT(4),
    allowNull: false
  },
  estado: {
    type: DataTypes.TINYINT(4),
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'eventos',
  timestamps: false
});

export default Evento;