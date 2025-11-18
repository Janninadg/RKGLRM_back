import express from "express";
import multer from "multer";
import UploadController from "../upload/UploadController.js";
import RoleValidator from "../utils/RoleValidator.js";

const router = express.Router();

// Roles permitidos para crear posts
const allowedRolesForPost = [13, 14, 15];

// temp dir (igual que tu middleware global)
const upload = multer({ dest: "C:/xampp/htdocs/files/.tmp-foro" });

// POST /api/uploads
router.post("/", upload.array("images"),RoleValidator.checkRolesMiddleware(allowedRolesForPost), UploadController.uploadImages);

// Chat: multiple images endpoint (final backend)
router.post("/chats/multi", upload.array("images"), UploadController.uploadChatImage);

// Chat: single image endpoint (final backend)
router.post("/chats", upload.single("image"), UploadController.uploadChatImage);

export default router;
