import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'image360') {
      cb(null, 'uploads/assets/360/');
    } else if (file.fieldname === 'ticketMedia') {
      cb(null, 'uploads/tickets/');
    } else {
      cb(null, 'uploads/assets/thumbnails/');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(4).toString('hex'); 
    const ext = path.extname(file.originalname);
    
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

export const upload = multer({ storage });