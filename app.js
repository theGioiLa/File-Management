var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var session = require('express-session');
var FileStorage = require('session-file-store')(session);
var uuid = require('uuid/v4');
var fs = require('fs');
var rimraf = require('rimraf');
var db = require('./db');

var UserModel = require('./models/User');
var FileModel = require('./models/File');

var app = express();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    genid: function(req) {
        return uuid();
    },
    secret: 'fine-uploader', 
    resave: false,
    saveUninitialized: true,
}));

app.use('/reset', function(req, res, next) {
  var upload_dir = path.join(__dirname, 'uploads/*');
  rimraf(upload_dir, function(err) {
    if (err) throw err;

    FileModel.remove({}, function(err) {
      if (err) throw err;
    });
  });

  UserModel.remove({}, function(err) {
    if (err) throw err;
    res.redirect('/user/login');
  });

});

app.use('/user', require('./routes/users'));
app.use('/files', require('./routes/files'));
app.use('/fines', require('./routes/fines'));

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

db.connect();

module.exports = app;