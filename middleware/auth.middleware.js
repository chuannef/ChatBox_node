import jwt from 'jsonwebtoken';

// Middleware to check if a user is already logged in
export function checkAuth(req, res, next) {
  const token = req.cookies.jwt;
  // Have no token (No logged yet)
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // If authenticated user try to access these paths. Redirect to home page
    if (req.path === '/login' || req.path === '/register') {
      return res.redirect('/');
    }
    return next();

  } catch (e) {
    res.clearCookie('jwt');
    return next();
  }
}

export function authenticateToken(req, res, next) {
  const token = req.cookies.jwt;

  // whitelist dont need to authentication
  const whitelistPaths = [
    '/users/login',
    '/users/register',
    '/users/logout',
  ];
  if (whitelistPaths.includes(req.path)) {
    return next();
  }

  if (!token) {
    if (req.path !== '/users/login') {
      return res.redirect('/users/login');
    }
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (e) {
    res.clearCookie('jwt');
    return res.redirect('/users/login');
  }

}
