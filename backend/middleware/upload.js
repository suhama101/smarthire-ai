const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 8;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

const uploadsDir = path.join(os.tmpdir(), 'smarthire-ai-uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname || '');
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }

    const error = new Error('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.');
    error.status = 400;
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error);
  },
});

const uploadBatch = upload.array('resumes', 20);

module.exports = { upload, uploadBatch };