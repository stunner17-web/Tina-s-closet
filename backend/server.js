require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); 


const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes); 


const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes); 

const path = require('path');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes); 


const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
  res.json({ message: "Tina's Closet API is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));