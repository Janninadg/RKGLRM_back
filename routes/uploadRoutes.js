import express from "express";
import multer from "multer";
import UploadController from "../upload/UploadController.js";

const router = express.Router();

// temp dir (igual que tu middleware global)
const upload = multer({ dest: "C:/xampp/htdocs/files/.tmp-foro" });

// POST /api/uploads
router.post("/", upload.array("images"), UploadController.uploadImages);

export default router;
