import fs from "fs/promises";
import path from "path";

class UploadService {
  async uploadImages(user, archivos) {
    const as = [];
    const ae = [];

    try {
      const uploadDir = "C:/xampp/htdocs/pictures/foro/";

      // crear carpeta si no existe
      await fs.mkdir(uploadDir, { recursive: true });

      for (const archivo of archivos) {
        const { path: tempPath, originalname } = archivo;

        try {
          // 🔹 obtener extensión original (ej: .jpg, .png)
          const ext = path.extname(originalname) || "";

          // 🔹 generar nombre único: timestamp + -foro + extensión
          const uniqueName = `${Date.now()}-foro${ext}`;

          const destPath = path.join(uploadDir, uniqueName);

          // mover archivo desde tmp a carpeta final
          await fs.rename(tempPath, destPath);

          // URL pública (xampp sirve desde htdocs)
          const url = `/pictures/foro/${uniqueName}`;

          as.push({ name: uniqueName, url });
        } catch (err) {
          ae.push({ error: err.message, originalname });
        }
      }

      return {
        success: true,
        code: ae.length > 0 ? "100" : "000",
        message:
          ae.length > 0
            ? "Algunas imágenes no se pudieron subir"
            : "Todas las imágenes subidas correctamente",
        archivos_subidos: as,
        archivos_error: ae,
      };
    } catch (error) {
      console.error("❌ Error en uploadImages:", error);
      return { success: false, code: "500", message: "Error en el servidor" };
    }
  }
}

export default new UploadService();
