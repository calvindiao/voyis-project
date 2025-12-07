const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');
const { Pool } = require('pg');
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


const initDb = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT,
      size BIGINT,
      width INTEGER,
      height INTEGER,
      is_corrupted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log("Database table 'images' is ready.");
  } catch (err) {
    console.error("Error creating table:", err);
  }
};
initDb();


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


app.get('/api/images', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM images ORDER BY created_at DESC');
    const images = result.rows.map(row => ({
      id: row.id,
      name: row.filename,
      url: `http://localhost:3000/uploads/${row.filename}`,
      type: (row.filename.endsWith('.tif') || row.filename.endsWith('.tiff')) ? 'tif' : 'standard',
      is_corrupted: row.is_corrupted,
      width: row.width,
      height: row.height,
      size: row.size
    }));

    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch images from DB' });
  }
});


app.post('/api/upload', upload.array('images'), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send('No files uploaded.');
    }
    let corruptedCount = 0;
    const processedFiles = [];


    await Promise.all(files.map(async (file) => {
      let width = null;
      let height = null;
      let isCorrupted = false;

      // 1. use Sharp to get image metadata
      try {
        const metadata = await sharp(file.path).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (err) {
        console.error(`Corrupted file: ${file.originalname}`);
        isCorrupted = true;
        corruptedCount++;
      }

      // 2. SQL insert statement
      const insertQuery = `
        INSERT INTO images (filename, path, type, size, width, height, is_corrupted)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `;

      const values = [
        file.filename,       // filename
        file.path,           // path (stored as server local path)
        file.mimetype,       // type (e.g., image/png)
        file.size,           // size (bytes)
        width,               // width
        height,              // height
        isCorrupted          // is_corrupted
      ];

      // 3. Execute insert
      try {
        await pool.query(insertQuery, values);
        processedFiles.push(file.filename);
      } catch (dbErr) {
        console.error("DB Insert Failed:", dbErr);
          // todo: handle cleanup here if needed
      }
    }));

    const totalSizeBytes = files.reduce((acc, file) => acc + file.size, 0);
    const formatSize = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    res.json({
      success: true,
      message: 'Upload and Sync complete',
      totalFiles: files.length,
      corruptedCount: corruptedCount,
      totalSize: formatSize(totalSizeBytes),
      fileList: processedFiles
    });

  } catch (error) {
    console.error('Upload handling error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.use('/uploads', express.static(IMAGES_DIR));

app.get('/api/download-zip', (req, res) => {
  const filesParam = req.query.files; // Frontend parameter format: ?files=img1.jpg,img2.png

  if (!filesParam) {
    return res.status(400).send('No files specified');
  }

  const fileList = filesParam.split(',');

  res.attachment('images.zip');

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  // Pipe the archive stream to the response stream
  archive.pipe(res);

  fileList.forEach(filename => {
    const filePath = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: filename });
    } else {
      console.warn(`File not found during zip: ${filename}`);
    }
  });
  archive.finalize();
});

app.post('/api/crop', async (req, res) => {
  const { filename, x, y, width, height } = req.body;


  if (!filename || width <= 0 || height <= 0) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const originalPath = path.join(IMAGES_DIR, filename);

  const timestamp = Date.now();
  const ext = path.extname(filename); // .jpg
  const nameBody = path.basename(filename, ext); // original
  const newFilename = `${nameBody}_crop_${timestamp}${ext}`;
  const newPath = path.join(IMAGES_DIR, newFilename);

  try {

    await sharp(originalPath)
      .extract({
        left: parseInt(x),
        top: parseInt(y),
        width: parseInt(width),
        height: parseInt(height)
      })
      .toFile(newPath);

    // const metadata = await sharp(newPath).metadata();
    const fileStats = fs.statSync(newPath);
    const metadata = await sharp(newPath).metadata();

    // database insert
    const insertQuery = `
      INSERT INTO images (filename, path, type, size, width, height, is_corrupted)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;

    const values = [
      newFilename,
      newPath,
      `image/${metadata.format}`, // Simplified mimetype
      fileStats.size,
      metadata.width,
      metadata.height,
      false
    ];

    await pool.query(insertQuery, values);

    res.json({ success: true, message: 'Crop successful', newFilename });

  } catch (error) {
    console.error('Crop error:', error);
    res.status(500).json({ error: 'Crop failed: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
});