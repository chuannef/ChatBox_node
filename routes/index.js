import {Router} from 'express';
import { verifyLogin } from '../middleware/check_login.js';

import IndexController from '../controller/index_controller.js';

let router = Router();

/* GET home page. */
router.get('/', verifyLogin, IndexController.index);

export default router;
