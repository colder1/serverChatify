import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import pg from 'pg';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: process.env.CLIENT_URL || "https://chatify-app-kappa.vercel.app",
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          content TEXT
      );
    `);
    console.log('DB Online');
  } catch (err) {
    console.error('DB Error:', err);
  }
};
initDB();

app.get('/', (req, res) => {
  res.send('<h1>Chatify Server Online</h1>');
});

io.on('connection', async (socket) => {
  try {
    const offset = socket.handshake.auth.serverOffset || 0;
    const result = await pool.query(
      'SELECT id, content FROM messages WHERE id > $1 ORDER BY id ASC',
      [offset]
    );
    result.rows.forEach(row => {
      socket.emit('chat message', row.content, row.id);
    });
  } catch (e) {
    console.error('History Error:', e);
  }

  socket.on('chat message', async (msg) => {
    if (!msg) return;
    try {
      const result = await pool.query(
        'INSERT INTO messages (content) VALUES ($1) RETURNING id',
        [msg]
      );
      const lastId = result.rows[0].id;
      io.emit('chat message', msg, lastId);
    } catch (e) {
      console.error('Insert Error:', e);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on port ${PORT}`);
});