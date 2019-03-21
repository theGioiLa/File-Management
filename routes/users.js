var express = require('express'),
    UserModel = require('../models/User'),
    FileModel = require('../models/File'),
    TokenModel = require('../models/Token'),
    rimraf = require('rimraf'),
    router = express.Router(),
    authen = require('../middleware/authen');

/* GET users listing. */ 
router.get('/login', function(req, res){
    res.render('login', {title: 'Login', message: req.session.message});
});

router.get('/register', function(req, res, next){
    res.render('register', {title: 'Register'});
});

router.get('/profile/:username', authen.authenticate, function(req, res) {
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

                    res.redirect('/drive/' + user.username);
                } else {
                    req.session.message = {
                        msg: "Password incorrect",
                        type: "danger"
                    };
                    res.redirect('login');
                }
            });
        } else {
            req.session.message = {
                msg: "Account doesn't exist",
                type: "danger"
            };
            res.redirect('login');
        }
    });
});

router.post('/register', function(req, res, next) {
    const home = new FileModel({
        filename: req.body.username,
        filepath: '/' + req.body.username,
        isFolder:  true,
    });

    home.save(function(err, home) {
        var user = new UserModel({
            username: req.body.username,
            password: req.body.password,
            home: home._id,
        });

        user.save(function(err, user) {
            home.parent = home._id;
            home.owner = user._id;
            home.save();
            req.session.message = {
                msg: "Register Successfully",
                type: "success"
            };
            console.log(req.session, req.sessionID);
            res.redirect('/user/login');
        });
    })
});

router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) throw err;
        res.redirect('login');
    });
});

router.get('/reset', function(req, res) {
    UserModel.findById(req.session.user.id).populate('home').exec(function(err, user) {
        if (err) throw err;

        var upload_dir = __dirname + '/../uploads/' + user.username;

        rimraf(upload_dir, function(err) {
            if (err) throw err;
        });

        FileModel.find({owner: user._id, _id: {$ne: user.home._id}}, function(err, files) {
            files.forEach(function(file) {
                TokenModel.deleteOne({owner: file._id}, function(err) {
                    if (err) {
                        console.err(err.message);
                        return;
                    }
                });

                file.remove();
            });
        });

        /*
        FileModel.deleteMany({owner: user._id, _id: {$ne: user.home._id}}, function(err) {
            if (err) throw err;
        });
        */

        user.home.files = [];
        user.home.save();

        res.redirect('/user/logout');
    });
});

module.exports = router;
