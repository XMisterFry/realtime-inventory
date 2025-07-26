require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
let inventoryCollection;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

client.connect().then(() => {
  const db = client.db('factoryDB');
  inventoryCollection = db.collection('inventory');
  console.log('✅ Connected to MongoDB');

  
});

// GET inventory
app.get('/data', async (req, res) => {
  try {
    const items = await inventoryCollection.find().toArray();
    const response = {};
    items.forEach(item => {
      // Key by product and warehouse for uniqueness
      const key = `${item.product} (${item.warehouse})`;
      response[key] = {
        product: item.product,
        quantity: item.quantity,
        lastUpdated: item.lastUpdated,
        warehouse: item.warehouse,
      };
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// POST update
app.post('/update', async (req, res) => {
  const { product, user, date, action, quantity, warehouse } = req.body;
  const qty = parseInt(quantity);

  if (!product || !user || !date || !action || !warehouse || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const item = await inventoryCollection.findOne({ product, warehouse });

    let newQty = qty;
    if (item) {
      newQty = item.quantity + (action === 'add' ? qty : -qty);
      if (newQty < 0) newQty = 0;

      await inventoryCollection.updateOne(
        { product, warehouse },
        { $set: { quantity: newQty, lastUpdated: date } }
      );
    } else {
      if (action === 'take') newQty = 0;
      await inventoryCollection.insertOne({
        product,
        warehouse,
        quantity: newQty,
        lastUpdated: date,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

