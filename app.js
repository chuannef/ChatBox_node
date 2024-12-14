import createError from 'http-errors';
import express, { json, urlencoded } from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { configServer } from './config/configServer.js';
import { connectMongodb } from './config/config_mongodb.js';
import session from 'express-session';
import flash from 'connect-flash';

import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

dotenv.config(); // Load environment variables

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

connectMongodb();

// view engine setup
app.set('views', join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET, // Ensure SESSION_SECRET is set in your .env file
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

app.use(flash());

app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser());

// app.use(authenticateToken);

app.use(express.static(join(__dirname, 'public')));


app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

configServer(app);

export default app;
