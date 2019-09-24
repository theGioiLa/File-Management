const router = require('express').Router(),
    FileModel = require('../models/File'),
    jws = require('jws'),
    geoip = require('geoip-lite');

router.get('/file/:token', function (req, res) {
    let token = req.params.token;
    let location = geoip.lookup(req.ip).city;
    let isAcceptedLoc = false;

    if (jws.verify(token, config.algorithm, config.secret)) {
        let data = JSON.parse(jws.decode(token).payload);

        FileModel.findById(data.id).populate('token').exec(function (err, file) {
            if (err) {
                console.error(err);
                return;
            }

            if (file) {
                file.token.acceptedLocation.forEach(function (loc) {
                    if (location == loc) isAcceptedLoc = true;
                });

                if (isAcceptedLoc) {
                    let views = file.token.views;
                    let lastAccess = new Date(Date.now());

                    let isNewDay = true;

                    for (let i = 0; i < views.length; i++) {
                        let visitedAt = new Date(views[i].visitedAt);

                        if (visitedAt.getFullYear() == lastAccess.getFullYear() &&
                            visitedAt.getMonth() == lastAccess.getMonth() &&
                            visitedAt.getDate() == lastAccess.getDate()) {
                            views[i].visits++;
                            isNewDay = false;
                            break;
                        }
                    }

                    if (isNewDay) {
                        views.push({
                            visitedAt: lastAccess,
                            visits: 1
                        });
                    }

                    file.token.lastAccess = lastAccess;
                    file.token.markModified('lastAccess');
                    file.token.markModified('views');
                    file.token.save();

                    if (file.token.expireIn >= lastAccess) {
                        let upload_dir = __dirname + '/../uploads/' + data.owner;

                        res.set({
                            'Content-Type': file.mimetype,
                            'Content-Length': file.size,
                        });

                        res.status(200).sendFile(file.filename, {
                            root: upload_dir
                        });
                    } else {
                        FileModel.updateOne({
                                _id: file._id
                            }, {
                                $unset: {
                                    token: ""
                                }
                            },
                            function (err, raw) {
                                if (err) console.error(err);
                            }
                        );

                        res.status(400).render('outOfTimeAccess', {
                            message: `Run out of time! Expire in ${data.expireIn.toLocaleString()}`
                        });
                    }
                } else {
                    res.status(400).render('outOfTimeAccess', {
                        message: `You 're out of location !`
                    });
                }
            } else {
                res.status(400).render('outOfTimeAccess', {
                    message: `File does not exist !`
                });
            }
        });
    } else {
        res.status(400).render('outOfTimeAccess', {
            message: `You don't have permisson to access this file !`
        });
    }
});

module.exports = router;
