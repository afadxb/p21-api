const express = require('express');
const app = express();

// The routes live inside the p21-api folder. The previous path was broken.
const salesOrderRoute = require('./p21-api/routes/salesorders');

app.use(express.json());
app.use('/api', salesOrderRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
