const express = require('express'),
    UserModel = require('../models/User'),
    uuidV4 = require('uuid/v4'),
    authen = require('../middleware/authen'),
    config = require('../config'),
    axios = require('axios'),
    http = require('http'),
    router = express.Router();

let user_stream_key = [];

router.get('/', authen.authenticate, function (req, res) {
    let _user = req.user;

    UserModel.findById(_user.id, function (err, user) {
        if (user.streamKey.length) {
            user_stream_key = user.streamKey;

            res.render('video_stream/index', {
                title: 'Video Stream',
                username: _user.username,
                streamKey: user.streamKey,
                rtmpServer: config.rtmpServer,
            });
        } else {
            let _streamKey = uuidV4();
            user_stream_key.push(_streamKey);

            UserModel.updateOne({
                _id: user.id
            }, {
                    $push: {
                        streamKey: _streamKey
                    }
                }, function (err, raw) {
                    if (err) throw err;

                    res.render('video_stream/index', {
                        title: 'Video Stream',
                        username: _user.username,
                        streamKey: [_streamKey],
                        rtmpServer: config.rtmpServer,
                    });
                })
        }
    });
});

router.get('/addKey', authen.authenticate, function (req, res) {
    let _streamKey = uuidV4();
    let user = req.user;
    user_stream_key.push(_streamKey);

    UserModel.updateOne({
        _id: user.id
    }, {
            $push: {
                streamKey: _streamKey
            }
        }, function (err, raw) {
            if (err) throw err;
            res.status(200).send(_streamKey);
        })
});

router.post('/connect', function (req, res) {
    console.log('------------*-------------');
    console.log('Body', req.body);
    res.status(200).end();
});

router.post('/play', function (req, res) {
    console.log('------------*-------------');
    console.log('Body', req.body);
    res.status(200).end();
});

router.post('/publish', function (req, res) {
    if (user_stream_key.length) {
        console.log('------------*-------------');
        console.log('Body', req.body);
        let streamKey = req.body.name;
        let isValidKey = false;

        for (let i = 0; i < user_stream_key.length; i++) {
            if (!streamKey.localeCompare(user_stream_key[i])) {
                return res.status(200).end();
            }
        }

        if (!isValidKey) {
            console.error('Stream key is invalid')
            return res.status(400).end();
        }
    } else {
        console.error('Server is not ready');
        return res.status(400).end();
    }
});

router.get('/livestream', function (req, res) {
    let _cdnHostname = '';
    axios.get(`${config.CDN_CONTROLLER_HOSTNAME}/cdnHostname`)
        .then(_res => {
            _cdnHostname = _res.data;
            console.log(_cdnHostname);

            UserModel.find({}, function (err, users) {
                if (err) console.error(err.message);
                else {
                    let _channels = [];

                    users.forEach(function (user) {
                        let keys = user.streamKey;
                        _channels = _channels.concat(keys);
                    });

                    console.log(_channels);

                    res.render('video_stream/livestream', {
                        cdnHostname: _cdnHostname,
                        channels: _channels
                    });
                }
            });
        });
});

router.get('/rtmp', (req, res) => {
    res.render('video_stream/livestream', {
        cdnHostname: 'test',
        channels: 'ap'
    });
})

module.exports = router;
