require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/routes');
const supabase = require('./config/supabase'); // Triggers connection configuration check on boot
// Trigger nodemon restart after env edit


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for mobile clients / sandbox
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Scheduled Backup Timer: checks every 30 seconds, fires once a day at 12:00 AM local time
let lastBackupDate = '';
setInterval(() => {
  const now = new Date();
  const todayStr = now.toDateString();
  if (now.getHours() === 0 && now.getMinutes() === 0 && lastBackupDate !== todayStr) {
    lastBackupDate = todayStr;
    console.log('Triggering scheduled midnight database backup email...');
    const { emailDailyBackup } = require('./controllers/controllers');
    const today = now.toISOString().split('T')[0];
    emailDailyBackup(today, today);
  }
}, 30 * 1000);

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

