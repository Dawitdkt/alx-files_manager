// Import required modules
const express = require('express');
const AppController = require('./controllers/AppController');

// Create Express app
const app = express();

// Set port
const port = process.env.PORT || 5000;

// Load all routes from routes/index.js
app.use('/', require('./routes'));

// Define endpoints in AppController.js
app.get('/status', AppController.getStatus);
app.get('/stats', AppController.getStats);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
