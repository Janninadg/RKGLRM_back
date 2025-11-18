import TokenSession from "../models/tokenSessionModel.js";
import UploadService from "./UploadService.js";

class UploadController {
  async uploadImages(req, res) {
    try {
      const { user } = req.body;
      const archivos = req.files;

      console.log("[FORO] Subiendo imágenes - User:", user);

      const response = await UploadService.uploadImages(user, archivos);

      if (response.success) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }
    } catch (error) {
      console.error("Error al subir imágenes del foro:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  async uploadChatImage(req, res) {
    try {
      const { user, chat, token } = req.body;
      const files = req.files;

      if (!files) {
        return res.status(400).json({
          success: false,
          message: "No se recibió ninguna imagen.",
        });
      }

       console.log("[CHAT] Subiendo imágenes - User:", user);

      // ✅ Verificar sesión/tokén
      const session = await TokenSession.findOne({ where: { id: user, token } });
      if (!session) {
        return res.status(200).json({
          success: false,
          code: "999",
          message: "Token inválido o expirado.",
        });
      }

      // ✅ Guardar imagen del chat
      const response = await UploadService.uploadChatImages(user, files, chat);

       if (response.success) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }
    } catch (error) {
      console.error("❌ Error en uploadChatImage:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno al subir imagen",
      });
    }
  }
}

export default new UploadController();
