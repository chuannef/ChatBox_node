import {Router} from 'express';
import UsersController from '../controller/users_controller.js';
import { loginValidation } from '../middleware/login_validation.js';
import { registerValidation } from '../middleware/register_validation.js';

import { verifyLogin } from '../middleware/check_login.js';

let router = Router();


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/login', UsersController.login);
router.post('/login', loginValidation, UsersController.loginRequest);

router.get('/register', UsersController.register);
router.post('/register', registerValidation, UsersController.registerRequest);

router.get('/logout', verifyLogin, UsersController.logout);

export default router;
