import express from 'express';
const app = express();
import router from './main.js';

app.use(express.json());
app.use('/', router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});