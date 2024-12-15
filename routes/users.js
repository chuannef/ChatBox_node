import {Router} from 'express';
import UsersController from '../controller/users_controller.js';
import { loginValidation } from '../middleware/login_validation.js';
import { registerValidation } from '../middleware/register_validation.js';

import { verifyLogin } from '../middleware/check_login.js';
import { checkAuth } from '../middleware/auth.middleware.js';

let router = Router();


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/login', checkAuth, UsersController.login);
router.post('/login', loginValidation, UsersController.loginRequest);

router.get('/register', UsersController.register);
router.post('/register', registerValidation, UsersController.registerRequest);

router.get('/logout', verifyLogin, UsersController.logout);

router.get('/profile', verifyLogin, (req, res) => {
  res.render('profile', { user: req.user }); 
});

router.get('/settings', verifyLogin, (req, res) => {
  res.render('setting', { user: req.user }); 
});
export default router;
