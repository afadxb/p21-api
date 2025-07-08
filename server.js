const express = require('express');
const app = express();
const salesOrderRoute = require('./api/routes/salesorder');

app.use(express.json());
app.use('/api', salesOrderRoute);

app.listen(3000, () => {
  console.log('API running on port 3000');
});
