const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configure database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: console.log, // Enable logging to debug SQL queries
});

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'customer'),
    allowNull: false,
  },
});

// Define Book model
const Book = sequelize.define('Book', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  genre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  publicationYear: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  aisle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  section: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// Middleware
app.use(bodyParser.json());

// Registration route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = await User.create({ username, password, role });
    res.status(201).json({ message: 'User created!', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (password !== user.password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, 'your_secret_key', { expiresIn: '1h' });
    res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error('Login error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

// Middleware to protect routes
const isAuth = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, 'your_secret_key');
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
  if (!decodedToken) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  req.userId = decodedToken.userId;
  req.userRole = decodedToken.role;
  next();
};

// Middleware to check admin role
const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// Book routes for admin
app.post('/api/v1/admin/books', isAuth, isAdmin, async (req, res) => {
  try {
    const book = await Book.create(req.body);
    res.status(201).json(book);
  } catch (error) {
    console.error('Add book error:', error); // Log the error
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/v1/admin/books/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    await book.update(req.body);
    res.status(200).json(book);
  } catch (error) {
    console.error('Update book error:', error); // Log the error
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/v1/admin/books/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    await book.destroy();
    res.status(204).end();
  } catch (error) {
    console.error('Delete book error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/v1/admin/customers', isAuth, isAdmin, async (req, res) => {
  try {
    const customers = await User.findAll({ where: { role: 'customer' } });
    res.status(200).json(customers);
  } catch (error) {
    console.error('Get customers error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

// Book routes for customers
app.get('/api/v1/books', isAuth, async (req, res) => {
  try {
    const books = await Book.findAll();
    res.status(200).json(books);
  } catch (error) {
    console.error('Get books error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/v1/books/:id', isAuth, async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json(book);
  } catch (error) {
    console.error('Get book by ID error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/v1/profile', isAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/v1/books/purchase/:id', isAuth, async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    if (book.quantity <= 0) {
      return res.status(400).json({ message: 'Book out of stock' });
    }

    book.quantity -= 1;
    await book.save();

    res.status(200).json({ message: 'Book purchased successfully', book });
  } catch (error) {
    console.error('Purchase book error:', error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Welcome to the Bookstore API. Use /api/v1/books to access the API.');
});

// Initialize the database and start the server
sequelize.sync().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});

// Seed the database with some books and users (run this separately if needed)
const seedDatabase = async () => {
  try {
    await sequelize.sync({ force: true });

    await User.bulkCreate([
      {
        username: 'admin',
        password: 'admin', // Plain text password for demonstration purposes
        role: 'admin',
      },
      {
        username: 'customer',
        password: 'customer', // Plain text password for demonstration purposes
        role: 'customer',
      },
    ]);

    await Book.bulkCreate([
      {
        title: "The Lord of the Rings",
        author: "J.R.R. Tolkien",
        genre: "Fantasy",
        publicationYear: 1954,
        aisle: "A1",
        section: "F1",
        quantity: 5,
      },
      {
        title: "Harry Potter and the Sorcerer's Stone",
        author: "J.K. Rowling",
        genre: "Fantasy",
        publicationYear: 1997,
        aisle: "A2",
        section: "F2",
        quantity: 10,
      },
      {
        title: "1984",
        author: "George Orwell",
        genre: "Dystopian",
        publicationYear: 1949,
        aisle: "A3",
        section: "D1",
        quantity: 8,
      },
    ]);

    console.log('Database has been seeded');
  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    process.exit();
  }
};

// Uncomment to seed the database
// seedDatabase();
