import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';

class UsersController {
  /**
   * User login form
   */
  static async login(req, res) {
    return res.render('login', { message: '' });
  }

  /**
   * User requests login
   */
  static async loginRequest(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).render('login', { message: 'username and password are required' });
    }

    const user = await User.findOne({ username });
    // There is no user in the database
    if (!user) return res.status(401).render('login', { message: 'User not found' });
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
        return res.render('index', { username: user.username, user_id: user._id });
      } catch (e) {
        // JWT error
        console.log(e); // Trace the errors 
        return res.status(500).render('login', { message: 'Internal server error'});
      }
    } else {
      // password is incorrect
      return res.status(401).render('login', { message: 'Incorrect credentials' });
    }
    
  }
}

export default UsersController;
