import {Router} from 'express';
import UsersController from '../controller/users_controller.js';

let router = Router();


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/login', UsersController.login);
router.post('/login', UsersController.loginRequest);

export default router;
