// CodeAlpha - Simple E-commerce Store
// Backend: Node.js + Express + SQLite
// Features: Products, Cart, Orders, User Registration/Login

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// -------- Database setup --------
const db = new Database('ecommerce.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    stock INTEGER DEFAULT 10
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Seed products if empty
  db.prepare('DELETE FROM products').run();
 {
  const seed = db.prepare('INSERT INTO products (name, description, price, image, stock) VALUES (?, ?, ?, ?, ?)');
  const items = [
    ['Wireless Headphones', 'Noise-cancelling over-ear headphones with 30hr battery.', 2999, 'https://via.placeholder.com/300?text=Headphones', 15],
    ['Smart Watch', 'Fitness tracker with heart-rate monitor and GPS.', 4999, 'https://via.placeholder.com/300?text=Smart+Watch', 20],
    ['Laptop Backpack', 'Water-resistant backpack with USB charging port.', 1499, 'https://via.placeholder.com/300?text=Backpack', 30],
    ['Bluetooth Speaker', 'Portable waterproof speaker with deep bass.', 1999, 'https://via.placeholder.com/300?text=Speaker', 25],
    ['Mechanical Keyboard', 'RGB backlit mechanical keyboard, blue switches.', 3499, 'https://via.placeholder.com/300?text=Keyboard', 12],
    ['Wireless Mouse', 'Ergonomic wireless mouse with silent clicks.', 899, 'https://via.placeholder.com/300?text=Mouse', 50]
  ];
  items.forEach(p => seed.run(...p));
}

// -------- Middleware --------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'codealpha-ecommerce-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Make user and cart available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = req.session.cart ? req.session.cart.reduce((s, i) => s + i.qty, 0) : 0;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// -------- Routes --------
app.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.render('index', { products });
});

app.get('/product/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).send('Product not found');
  res.render('product', { product });
});

// Register
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hash);
    res.redirect('/login');
  } catch (e) {
    res.render('register', { error: 'Username or email already exists.' });
  }
});

// Login
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Invalid credentials.' });
  }
  req.session.user = { id: user.id, username: user.username, email: user.email };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Cart
app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const items = cart.map(c => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(c.id);
    return { ...p, qty: c.qty, subtotal: p.price * c.qty };
  });
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  res.render('cart', { items, total });
});

app.post('/cart/add/:id', (req, res) => {
  const id = parseInt(req.params.id);
  req.session.cart = req.session.cart || [];
  const existing = req.session.cart.find(i => i.id === id);
  if (existing) existing.qty += 1;
  else req.session.cart.push({ id, qty: 1 });
  res.redirect('/cart');
});

app.post('/cart/remove/:id', (req, res) => {
  const id = parseInt(req.params.id);
  req.session.cart = (req.session.cart || []).filter(i => i.id !== id);
  res.redirect('/cart');
});

// Checkout
app.post('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const items = cart.map(c => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(c.id);
    return { ...p, qty: c.qty };
  });
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const info = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(req.session.user.id, total);
  const orderId = info.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
  items.forEach(i => insertItem.run(orderId, i.id, i.qty, i.price));

  req.session.cart = [];
  res.redirect('/orders');
});

app.get('/orders', requireLogin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  const detailed = orders.map(o => {
    const items = db.prepare(`
      SELECT oi.*, p.name FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?`).all(o.id);
    return { ...o, items };
  });
  res.render('orders', { orders: detailed });
});

app.listen(PORT, () => console.log(`E-commerce running on http://localhost:${PORT}`));
