// Importa Sequelize y la conexión a la base de datos
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar la configuración de tu base de datos

// Define el modelo RoulettePrize
const RoulettePrize = sequelize.define('rouletteprizes', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  idRoulette: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '0: cash, 1: oro, 2: item'
  },
  clase: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  prize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  url: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  probability: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  type_game: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  // Otras opciones del modelo
  tableName: 'rouletteprizes', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes campos createdAt y updatedAt en tu tabla
});

// Exporta el modelo para su uso en otras partes de tu aplicación
export default RoulettePrize;
