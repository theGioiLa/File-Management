var express = require('express');
var UserModel = require('../models/User');
var router = express.Router(); /* GET users listing. */ router.get('/login', function(req, res, next){
    res.render('login', {title: 'Login'});
});

router.get('/register', function(req, res, next){
    res.render('register', {title: 'Register'});
});

router.post('/login', function(req, res, next) {
    req.session.isLogined = false;
    UserModel.findOne({username: req.body.username}, function(err, user) {
        if (err) throw err;
        if (user) {

            user.comparePassword(req.body.password, function(err, isMatch) {
                if (err) throw err;

                if (isMatch) {
                    req.session.isLogined = true;
                    req.session.user = {
                        id: user._id,
                        username: user.username,
                        files: user.files
                    };
                    res.redirect('/files/' + user.username);
                } else {
                    res.redirect('login');
                }
            });
        } else {
            res.redirect('login');
        }
    });
});

router.post('/register', function(req, res, next) {
    var user = new UserModel({ 
        username: req.body.username,
        password: req.body.password
    });

    UserModel.addUser(user, function(err, user) {
        if (err) throw err;
        res.redirect('login');
    });
});

router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) throw err;
        res.redirect('login');
    });
});

module.exports = router;
