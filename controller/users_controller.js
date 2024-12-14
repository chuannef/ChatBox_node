import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';

class UsersController {
  static async logout(req, res) {
    try {
      const cookie = req.cookies.jwt;
      if (cookie) { res.clearCookie('jwt'); }

      req.flash('message', 'Successfully logged out');
      return res.redirect('/users/login');
    } catch (e) {
      console.log(e);
      req.flash('message', 'An error occur during logout');
      return res.redirect('/users/login');
    }
  }

  static async login(req, res) {
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];
    const loginRequired = req.flash('loginRequired')[0];

    return res.render('login', { 
      message: successMessage || errorMessage || loginRequired,
      success: !!successMessage,
    });
  }

  static async register(req, res) {
    // Check if user already logged in
    if (req.cookies || req.cookies.jwt) {
      return res.redirect('/');
    }
    return res.render('register', { message: '' });
  }

  static async registerRequest(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render('register', { message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });

    if (existingUser) {
      return res.status(409).render('register', { 
        message: 'Username is already taken', 
        oldInput: { username } 
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: username.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
    });

    try {
      await newUser.save();
      req.flash('success', 'Registration successful! Please log in');
      return res.redirect('/users/login');
    } catch (e) {
      if (e.name === 'ValidationError') {
        return res.status(400).render('register', { 
          message: 'Invalid input data', 
          oldInput: { username: req.body.username } 
        });
      }

      return res.status(500).render('register', { 
        message: 'Internal Server Error, please try again', 
        oldInput: { username: req.body.username } 
      });
    }
  }

  static async loginRequest(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).render('login', { message: 'Username and password are required' });
      }

      const user = await User.findOne({ username });
      // If there is no user in the database
      if (!user) {
        return res.status(401).render('login', { 
          message: 'Invalid credentials', 
          oldInput: { username: req.body.username } 
        });
      }

      const decodedPassword = await bcrypt.compare(password, user.password);

      if (decodedPassword) {
        const payload = { user_id: user._id, username: user.username };

        try {
          // Generate token
          const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
          // Setting cookie
          res.cookie('jwt', token, { httpOnly: true, maxAge: 3600000, sameSite: 'strict' });
          return res.redirect('/');
        } catch (e) {
          console.log(e);
          return res.status(500).render('login', { message: 'Internal server error' });
        }
      } else {
        return res.status(401).render('login', { 
          message: 'Incorrect credentials', 
          oldInput: { username: req.body.username } 
        });
      }
    } catch (e) {
      return res.status(500).render('login', { 
        message: 'An error occured during login', 
        oldInput: { username: req.body.username } 
      });
    }
  }
}

export default UsersController;
