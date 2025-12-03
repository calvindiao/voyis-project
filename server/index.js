// server/index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 数据库连接配置
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'voyis_data',
  password: 'password',
  port: 5432,
});

// 测试接口：检查服务器状态
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

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
});