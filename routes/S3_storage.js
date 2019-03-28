const rimraf = require('rimraf');
    router = require('express').Router(),
    FileModel = require('../models/File'),
    UserModel = require('../models/User'),
    TokenModel = require('../models/Token'),
    multiparty = require('multiparty'),
    nodemailer = require('nodemailer'),
    config = require('../config'),
    jws = require('jws'),
    authen = require('../middleware/authen');


// router.use(authen.authenticate);

router.get('/', function(req, res) {
    res.send('S3 station');
});

module.exports = router;
