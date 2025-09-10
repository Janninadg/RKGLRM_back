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
}

export default new UploadController();
