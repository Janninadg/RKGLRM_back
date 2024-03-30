import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Ticket = sequelize.define('ticket', {
  id: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false
  },
  tickets: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'tickets', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default Ticket;
