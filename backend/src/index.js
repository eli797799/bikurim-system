import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';

import suppliersRouter from './routes/suppliers.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import shoppingListsRouter from './routes/shopping-lists.js';
import { errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/suppliers', suppliersRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/shopping-lists', shoppingListsRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Bikurim API' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
