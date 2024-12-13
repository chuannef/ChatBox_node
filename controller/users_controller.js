import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';

class UsersController {
  /**
   * User login form
   */
  static async login(req, res) {
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];
    const loginRequired = req.flash('loginRequired')[0]

    return res.render('login', { 
      message: successMessage || errorMessage || loginRequired, 
      success: !!successMessage, // convert message to true/false
    });
  }

  /**
   * User registration form
   */
  static async register(req, res) {
    return res.render('register', {message: ''});
  }

  /**
   * User requests registration
   */
  static async registerRequest(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).render('register', { message: 'username and password are required' });
    }
    // Check if the username is already taken
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') } // search for case insensitive
    }); 

    if (existingUser) return res.status(409).render('register', 
      { message: 'Username is already taken, please type another name', oldInput: { username } }
    );

    const salt = await bcrypt.genSalt(12); // The salt to be used in encryption
    // Hashed password
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: username.toLowerCase(),
      password: hashedPassword, // Save hashed password
      createdAt: new Date()
    });

    try {
      await newUser.save();
      req.flash('success', 'Registration successful! Please log in');
      return res.redirect('/users/login');
      // return res.status(201).render('login', { message: 'Registered successfully', success: true });
    } catch (e) {
      // Take a look at ../middleware/register_validation.js
      if (e.name == 'ValidationError') {
        return res.status(400).render(
          'register', { message: 'Invalid input data', oldInput: { username: req.body.username } });
      }

      return res.staus(500).render('register', 
        { message: 'Internal Server Error, please try again', oldInput: { username: req.body.username } });
    }
  }

  /**
   * User requests login
   */
  static async loginRequest(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).render('login', { message: 'username and password are required' });
      }
      const user = await User.findOne({ username });
      // There is no user in the database
      if (!user) return res.status(401).render('login', { message: 'Invalid credentials' });
      // Compare plain password and hashed password
      const decodedPassword = await bcrypt.compare(password, user.password);
      // If password is correct
      if (decodedPassword) {
        const payload = {
          user_id: user._id,
          username: user.username
        };
        try {
          // Generate token, return the JSON web token string. Expires in 1 hour
          const token = jwt.sign(payload, process.env.JWT_SECRET, { 'expiresIn': '1h', algorithm: 'HS256' });
          res.cookie('jwt', token, {
            httpOnly: true, 
            maxAge: 3600000,
            sameSite: 'strict'
          });
          // user's information is correct and token generates without error
          // return res.render('index', { username: user.username, user_id: user._id });
          // req.flash('username', user.username);
          // req.flash('user_id', user._id);
          return res.redirect('/');
        } catch (e) {
          // JWT error
          console.log(e); // Trace the errors 
          return res.status(500).render('login', { message: 'Internal server error'});
        }
      } else {
        // password is incorrect
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
