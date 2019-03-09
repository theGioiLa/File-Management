var express = require('express');
var UserModel = require('../models/User');
var rimraf = require('rimraf');
var router = express.Router();

/* GET users listing. */ 
router.get('/login', function(req, res, next){
    res.render('login', {title: 'Login', message:''});
});

router.get('/register', function(req, res, next){
    res.render('register', {title: 'Register'});
});

router.get('/profile/:username', function(req, res) {
    res.render('user_profile', {title: 'File Manager', username: req.params.username});
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
    console.log(req.body.username);
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

router.get('/reset', function(req, res) {
    UserModel.findById(req.session.user.id).populate('files').exec(function(err, user) {
        if (err) throw err;

        let filesId = [];
        var upload_dir = __dirname + '/../uploads/' + user.username;
        console.log(upload_dir);

        rimraf(upload_dir, function(err) {
            console.log(upload_dir);
            if (err) throw err;
        });

        user.files.forEach(element => {
            filesId.push(element._id);
            element.remove(function(err, file) {
                if (err) throw err;
            });
        });

        UserModel.update(
            { _id: user._id},
            {$pullAll: {files: filesId}},
            {multi: true}, 

            function(err, raw) {
                if (err) throw err;

            }
        );

        res.redirect('/user/logout');
    });
});

module.exports = router;
