// models/ItemImage.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia Sequelize

const ItemImage = sequelize.define('ItemImage', {
  item: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Suponiendo que 'item' es clave primaria en tu tabla
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: false,
  }
}, {
  tableName: 'itemimages', // Nombre de la tabla
  timestamps: false, // Si no tienes createdAt o updatedAt
});

export default ItemImage;
