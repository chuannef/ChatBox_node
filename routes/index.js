import {Router} from 'express';
import { verifyLogin } from '../middleware/check_login.js';

import IndexController from '../controller/index_controller.js';

let router = Router();

/* GET home page. */
router.get('/', verifyLogin, IndexController.index);

router.get('/test-cookie', (req, res) => {
    const testToken = 'test-token-' + Date.now();
    
    res.cookie('testJwt', testToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 3600000
    });

    res.json({ 
        message: 'Test cookie set',
        token: testToken,
        cookies: req.cookies
    });
});

export default router;
