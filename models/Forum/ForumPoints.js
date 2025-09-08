// models/ForumPoints.js
import { DataTypes } from "sequelize";
import sequelize from '../../config/database.js';

const ForumPoints = sequelize.define("ForumPoints", {
  user_id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false,
  },
  post_points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  reply_points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_points: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.post_points + this.reply_points;
    },
    set(value) {
      throw new Error("No se puede setear total_points directamente");
    },
  },
}, {
  tableName: "forum_points",
  timestamps: true,
  updatedAt: "updated_at",
  createdAt: false,
});

export default ForumPoints;
