const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');
const app = express();
const port = 3000;

const IMAGES_DIR = path.join(__dirname, 'images_storage');

app.use(cors());
app.use(express.json());

// db configuration
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'voyis_data',
  password: 'password',
  port: 5432,
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|tif|tiff/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG, TIF) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter
});


// Test check database connection
app.get('/api/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'Server is running',
      db_time: result.rows[0].now
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/upload', upload.array('images'), (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send('No files uploaded.');
    }

    // Calculate statistics
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);

    res.json({
      message: 'Upload successful!',
      totalFiles: files.length,
      totalSize: (totalSize / 1024 / 1024).toFixed(2) + ' MB', // Convert to MB
      fileList: files.map(f => f.filename)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/uploads', express.static(IMAGES_DIR));

app.get('/api/images', (req, res) => {

  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan files' });
    }

    const imageFiles = files.filter(file =>
      /\.(jpg|jpeg|png|tif|tiff)$/i.test(file)
    );

    const response = imageFiles.map(file => {
      const isTif = /\.(tif|tiff)$/i.test(file);
      return {
        name: file,
        url: `http://localhost:3000/uploads/${file}`,
        type: isTif ? 'tif' : 'standard'
      };
    });

    res.json(response);
  });
});


app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
});