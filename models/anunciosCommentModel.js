// models/AnunciosComment.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const AnunciosComment = sequelize.define('AnunciosComment', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Clave primaria
    autoIncrement: true, // Auto-incremental
  },
  anuncio: {
    type: DataTypes.INTEGER(11), // Referencia al ID del anuncio
    allowNull: false,
  },
  apodo: {
    type: DataTypes.STRING(20), // Apodo del usuario, tipo varchar(20)
    allowNull: false,
    collate: 'utf8mb4_general_ci', // Cotejamiento para soportar caracteres especiales
  },
  comentario: {
    type: DataTypes.TEXT('medium'), // Comentario, tipo texto con utf8mb4_general_ci
    allowNull: false,
    collate: 'utf8mb4_general_ci', // Soporte para emojis y caracteres especiales
  },
  fecha: {
    type: DataTypes.DATE, // Fecha del comentario, tipo datetime
    allowNull: false,
  }
}, {
  tableName: 'anuncioscomment', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default AnunciosComment;
