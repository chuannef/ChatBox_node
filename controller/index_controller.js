class IndexController {
  /** 
   * GET home page. Only verify user can access to this page
   */
  static async index(req, res) {
    // const username = req.flash('username')[0];
    // const user_id = req.flash('user_id')[0];
    const user = req.user; // Take a look at ../middleware/check_login.js
    return res.render('index', { username: user.username, user_id: user.id });
  }

}

export default IndexController;
