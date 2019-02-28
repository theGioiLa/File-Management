var express = require('express');
var UserModel = require('../models/User');
var router = express.Router();

/* GET home page. */
router.post('/login', function(req, res, next) {
    UserModel.findOne({username: req.body.username}, function(err, user) {
        if (err) throw err;

        user.comparePassword(req.body.password, function(err, isMatch) {
            if (err) throw err;

            if (isMatch) {
                req.isLogined = true;
                next();
            } else {
                res.redirect('/login');
            }
        });
    });
});

router.post('/register', function(req, res, next) {
    var user = new UserModel({ 
        username: req.body.username,
        password: req.body.password
    });

    UserModel.addUser(user, function(err, user) {
        if (err) throw err;
        res.redirect('/login');
    });
});

module.exports = router; 