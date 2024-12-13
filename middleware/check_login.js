import jwt from 'jsonwebtoken';

export function verifyLogin(req, res, next) {
  if (!req.cookies) {
    return res.render('login', { message: 'You have to login first' });
  }
  const token = req.cookies.jwt;
  if (!token) {
    req.flash('loginRequired', 'You have to log in');
    return res.redirect('/users/login');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '1h' // token expiration
    });
    // Generate new token if it is about expire within 5 minutes: Auto-Renewal
    const tokenExp = decoded.exp * 1000; // convert to miliseconds
    const fiveMinutes = 5 * 60 * 1000; // miliseconds
    if (tokenExp - Date.now() < fiveMinutes) {

      // const token = jwt.sign(payload, process.env.JWT_SECRET, { 'expiresIn': '1h', algorithm: 'HS256' });
      const newToken = jwt.sign(
        { user_id: decoded.user_id, username: decoded.username }, // payload
        process.env.JWT_SECRET,
        { 'expiresIn': '1h' }
      );

      // res.cookie('jwt', token, {
      //   httpOnly: true, 
      //   maxAge: 3600000,
      //   sameSite: 'strict'
      // });
      // new token will lives within 1h
      res.cookie('jwt', newToken, {
        httpOnly: true,
        maxAge: 3600000, // 1h
        sameSite: 'strict'
      });
    }

    req.user = {
      id: decoded.user_id,
      username: decoded.username
    };
    return next();
  } catch (e) {
    console.log('JWT Verification Error: ', e.name, e.message);
    res.clearCookie('jwt');
    console.log(e.name);
    return res.render('login', { message: 'Cookies is wrong' });
  }
}
