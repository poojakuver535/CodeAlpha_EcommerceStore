# CodeAlpha - Simple E-commerce Store

A full-stack e-commerce site built for the CodeAlpha Full Stack Internship.

## Features
- Product listings with images, prices, and details
- Product detail page
- Shopping cart (add / remove)
- User registration & login (bcrypt + session)
- Order processing & order history
- SQLite database (auto-created, pre-seeded with sample products)

## Tech Stack
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Views: EJS templates
- Auth: express-session + bcryptjs

## Run
```bash
npm install
npm start
```
Open http://localhost:3000

## Project Structure
```
server.js              # Main server + routes
views/                 # EJS templates
public/style.css       # Styles
ecommerce.db           # Auto-created SQLite database
```

## Author
Built for CodeAlpha Internship.
