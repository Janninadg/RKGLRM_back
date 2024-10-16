import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Anuncio = sequelize.define('anuncios', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  titulo: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  autor: {
    type: DataTypes.STRING(50),
    defaultValue: 'Rakion Glorium', // Si es nulo, utiliza el valor predeterminado
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  adicional: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imagen: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue:'/pictures/rakxmas.png',
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  importante: {
    type: DataTypes.TINYINT(4),
    allowNull: false,
    defaultValue: 0 // Si es nulo, utiliza el valor predeterminado
  },
  estado: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 1 // Si es nulo, utiliza el valor predeterminado
  }
}, {
  tableName: 'anuncios',
  timestamps: false
});

export default Anuncio;
