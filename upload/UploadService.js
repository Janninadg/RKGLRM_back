import fs from "fs/promises";
import path from "path";

const BASE_CHAT = 'C:/xampp/htdocs/pictures/chat/temp/';

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

   async saveChatImage(user, file, chat) {
    try {
      // Crear carpeta del chat
      const chatDir = path.join(BASE_CHAT, String(chat || "temp"));
      await fs.mkdir(chatDir, { recursive: true });

      // Obtener extensión y generar nombre único
      const ext = path.extname(file.originalname) || ".jpg";
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "");
      const uniqueName = `${timestamp}-${user || "anon"}${ext}`;
      const destPath = path.join(chatDir, uniqueName);

      // Mover archivo temporal
      await fs.rename(file.path, destPath);

      // URL pública
      const url = `/pictures/chat/temp/${chat}/${uniqueName}`;

      return {
        success: true,
        code: "000",
        message: "Imagen subida correctamente",
        file: {
          name: uniqueName,
          url,
          chat_id: chat,
        },
      };
    } catch (err) {
      console.error("❌ Error guardando imagen de chat:", err);
      return { success: false, code: "500", message: "Error guardando imagen" };
    }
  }

  // NUEVO: subir múltiples imágenes para un chat (carpeta por chat)
  async uploadChatImages(user, archivos, chat) {
    const as = [];
    const ae = [];

    try {
      // carpeta del chat: C:/xampp/htdocs/pictures/chat/{chat}/
      const uploadDir = path.join(BASE_CHAT, String(chat || "temp"));
      await fs.mkdir(uploadDir, { recursive: true });

      for (const archivo of archivos) {
        const { path: tempPath, originalname } = archivo;
        try {
          const ext = path.extname(originalname) || "";
          // nombre único: timestamp + -chat + rnd + ext
          const uniqueName = `${Date.now()}-chat${Math.random().toString(36).slice(2,6)}${ext}`;
          const destPath = path.join(uploadDir, uniqueName);

          // mover del temp (multer) a la carpeta final del chat
          await fs.rename(tempPath, destPath);

          // URL pública (xampp htdocs)
          const url = `/pictures/chat/temp/${chat}/${uniqueName}`;

          as.push({ name: uniqueName, url, chat_id: chat });
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
      console.error("❌ Error en uploadChatImages:", error);
      return { success: false, code: "500", message: "Error en el servidor" };
    }
  }
}

export default new UploadService();
