var createError = require('http-errors'),
  express = require('express'),
  path = require('path'),
  logger = require('morgan'),
  session = require('express-session'),
  FileStorage = require('session-file-store')(session),
  uuid = require('uuid/v4'),
  rimraf = require('rimraf'),
  db = require('./db');

var UserModel = require('./models/User');
var FileModel = require('./models/File');

var app = express();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var storage_options = {
  ttl: 1800 // 30 min
};

var session_store = new FileStorage(storage_options);

app.use(session({
    genid: function(req) {
        return uuid();
    },
    store: session_store,
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
app.use('/drive', require('./routes/files'));

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
