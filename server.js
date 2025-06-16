const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'connectpro_db'
});

db.connect((err) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
    throw err;
  }
  console.log('✅ MySQL connected successfully.');
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { name, email, password, interests } = req.body;

  if (!name || !email || !password || !interests) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error during user check' });
      if (result.length > 0) {
        return res.status(400).json({ message: 'User already exists' });
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(
          'INSERT INTO users (name, email, password, interests) VALUES (?, ?, ?, ?)',
          [name, email, hashedPassword, interests],
          (err) => {
            if (err) {
              console.error('❌ Error inserting user:', err);
              return res.status(500).json({ message: 'Registration failed' });
            }
            console.log(`✅ User registered: ${email}`);
            res.status(201).json({ message: 'User registered successfully' });
          }
        );
      }
    });
  } catch (error) {
    console.error('❌ Server error during signup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error during login' });

    if (result.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    const user = result[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      console.log(`✅ Login successful: ${email}`);
      res.json({
        message: 'Login successful',
        user: { name: user.name, email: user.email, interests: user.interests }
      });
    } else {
      res.status(400).json({ message: 'Incorrect password' });
    }
  });
});

// Fetch similar users based on shared interests
app.get('/similar-users/:email', (req, res) => {
  const userEmail = req.params.email;

  db.query('SELECT interests FROM users WHERE email = ?', [userEmail], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error during interests fetch' });
    if (result.length === 0) return res.status(404).json({ message: 'User not found' });

    const interestsArray = result[0].interests.split(',').map(i => i.trim());
    if (interestsArray.length === 0) return res.json([]);

    const conditions = interestsArray.map(() => `interests LIKE ?`).join(' OR ');
    const values = interestsArray.map(interest => `%${interest}%`);

    db.query(
      `SELECT name, email, interests FROM users WHERE email != ? AND (${conditions})`,
      [userEmail, ...values],
      (err, users) => {
        if (err) {
          console.error('❌ Error fetching similar users:', err);
          return res.status(500).json({ message: 'Error fetching similar users' });
        }
        res.json(users);
      }
    );
  });
});

// Save chat message
app.post('/send-message', (req, res) => {
  const { sender, receiver, message } = req.body;

  if (!sender || !receiver || !message) {
    return res.status(400).json({ message: 'Missing sender, receiver, or message' });
  }

  db.query(
    'INSERT INTO messages (sender_email, receiver_email, message, timestamp) VALUES (?, ?, ?, NOW())',
    [sender, receiver, message],
    (err) => {
      if (err) {
        console.error('❌ Error sending message:', err);
        return res.status(500).json({ message: 'Failed to send message' });
      }
      console.log(`✅ Message sent from ${sender} to ${receiver}`);
      res.json({ message: 'Message sent successfully' });
    }
  );
});

// Fetch chat history between two users
app.get('/get-messages', (req, res) => {
  const { user1, user2 } = req.query;

  if (!user1 || !user2) {
    return res.status(400).json({ message: 'Missing user1 or user2 in query' });
  }

  db.query(
    `SELECT sender_email AS sender, receiver_email AS receiver, message, timestamp FROM messages
     WHERE (sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?)
     ORDER BY timestamp ASC`,
    [user1, user2, user2, user1],
    (err, results) => {
      if (err) {
        console.error('❌ Error fetching messages:', err);
        return res.status(500).json({ message: 'Failed to fetch messages' });
      }
      res.json(results);
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
