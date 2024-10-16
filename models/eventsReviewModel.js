// models/EventsReview.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const EventsReview = sequelize.define('EventsReview', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Clave primaria
    autoIncrement: true, // Auto-incremental
  },
  apodo: {
    type: DataTypes.STRING(20), // Apodo del usuario, tipo varchar(20)
    allowNull: false,
    collate: 'utf8mb4_general_ci', // Cotejamiento para soportar caracteres especiales
  },
  evento: {
    type: DataTypes.INTEGER(11), // Referencia al ID del evento
    allowNull: false,
  },
  review: {
    type: DataTypes.TEXT, // Comentario o review
    allowNull: false,
    collate: 'utf8mb4_general_ci', // Soporte para emojis y caracteres especiales
  },
  points: {
    type: DataTypes.INTEGER(11), // Puntos asignados al evento
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATE, // Fecha del review
    allowNull: false,
  }
}, {
  tableName: 'eventsreview', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default EventsReview;
