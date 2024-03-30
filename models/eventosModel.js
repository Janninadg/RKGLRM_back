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
  show: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'eventos',
  timestamps: false
});

export default Evento;
