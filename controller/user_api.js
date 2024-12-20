import { User } from '../models/user.js';
import { Message } from '../models/message.js';


class UserApi {
  static async removeMessage(req, res) {
    const user = req.user; // Take a look at ../middleware/check_login.js
    if (!user) {
      return res.redirect('/login');
    }
    const { messageId } = res.params;
  }
}

export default UserApi;
