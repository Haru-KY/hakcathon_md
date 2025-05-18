// var cookieParser = require('cookie-parser');

import createError from 'http-errors';
import express from 'express';
import path from 'path';
import logger from 'morgan';

import { fileURLToPath } from 'url';

import indexRouter from './routes/index.js';
import homeRouter from './routes/home.js';
import usersRouter from './routes/users.js';
import loginRouter from './routes/login.js';
import regiRouter from './routes/register.js';
import addRouter from './routes/add.js';
var app = express();

// view engine setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', homeRouter);
app.use('/users', usersRouter);
app.use('/login', loginRouter);
app.use('/register', regiRouter);
app.use('/add', addRouter);

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

export default app;

