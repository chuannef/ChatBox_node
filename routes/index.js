import {Router} from 'express';
let router = Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Chinhcom' });
});

export default router;
