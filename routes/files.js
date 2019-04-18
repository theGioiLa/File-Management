const rimraf = require('rimraf');
router = require('express').Router(),
    FileModel = require('../models/File'),
    UserModel = require('../models/User'),
    TokenModel = require('../models/Token'),
    multiparty = require('multiparty'),
    uploader = require('./upload-utils'),
    nodemailer = require('nodemailer'),
    config = require('../config'),
    jws = require('jws'),
    authen = require('../middleware/authen'),
    normalize = require('../normalize').normalizeSize;

let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});


router.use(authen.authenticate);
uploader.init({
    maxFileSize: 1e13,
    uploadedFilesPath: __dirname + '/../uploads/'
});

router.get('/:username', function (req, res) {
    if (req.user.username === req.params.username) {
        UserModel.findById(req.user.id)
            .populate({
                path: 'home',
                populate: {
                    path: 'files'
                }
            })
            .exec(function (err, user) {
                if (err) throw err;
                req.session.currFolder = {
                    id: user.home._id,
                    path: user.home.filepath,
                };


                res.render('resource', {
                    title: 'File Manager',
                    username: req.params.username,
                    currDir_path: user.home.filepath,
                    parent: user.home.parent,
                    childrend: user.home.files,
                    normalizeSize: normalize
                });
            });
    } else res.redirect('/');
});

//New Folder
router.post('/:username/newFolder', function (req, res) {
    var folder = new FileModel({
        filename: req.body.newFolder,
        filepath: req.session.currFolder.path + '/' + req.body.newFolder,
        parent: req.session.currFolder.id,
        isFolder: true,
        owner: req.user.id
    });

    FileModel.newFolder(folder, function (err, folder) {
        if (err) throw err;
        FileModel.updateOne({
                _id: req.session.currFolder.id
            }, {
                $push: {
                    files: folder._id
                }
            },
            function (err, raw) {
                if (err) throw err;
                res.redirect('/drive/' + req.params.username + '/view/' + req.session.currFolder.id);
            }
        );
    });
});

//Upload File
router.post('/:username/upload', (req, res) => {
    var form = new multiparty.Form();

    form.parse(req, function (err, fields, files) {
        if (err) return;

        var partIndex = fields.qqpartindex;
        var file = files.qqfile[0];
        var owner = req.params.username;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");

        if (partIndex == null) {
            file.mimetype = file.headers['content-type'];
            uploader.onSimpleUpload(fields, file, owner, res, onSaved);
        } else {
            uploader.onChunkedUpload(fields, file, owner, res, onSaved);
        }
    });

    function onSaved(file) {
        FileModel.find({
            filename: file.name
        }, function (err, files) {
            if (err) {
                console.error(err.message);
                return;
            }

            if (files.length == 0) {
                var doc = new FileModel({
                    uuid: file.uuid,
                    filename: file.name,
                    size: file.size,
                    mimetype: file.mimetype,
                    parent: req.session.currFolder.id,
                    owner: req.user.id
                });

                doc.save().then(function (file) {
                    FileModel.updateOne({
                            _id: file.parent
                        }, {
                            $push: {
                                files: file._id
                            }
                        },
                        function (err, raw) {
                            if (err) throw err;
                        }
                    );
                });
            }
        });
    }
});

router.get('/:username/download/:id', function (req, res) {
    FileModel.findById(req.params.id, 'filename', function (err, file) {
        if (err) throw err;
        if (!file.isFolder) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            res.download(upload_dir + file.filename);
        } else {
            res.end('Cannot donwload this folder!');
        }
    });
});

router.get('/:username/view/:id', function (req, res) {
    FileModel.findById(req.params.id).populate('files').exec(function (err, file) {
        if (err) throw err;
        if (file) {
            if (!file.isFolder) { // view File
                let upload_dir = __dirname + '/../uploads/' + req.params.username;
                res.set({
                    'Content-Type': file.mimetype,
                    'Content-Length': file.size,
                });
                res.sendFile(file.filename, {
                    root: upload_dir
                });
            } else { // view Folder
                req.session.currFolder.path = file.filepath;
                req.session.currFolder.id = file._id;

                res.render('resource', {
                    title: 'File Manager',
                    username: req.params.username,
                    currDir_path: file.filepath,
                    parent: file.parent,
                    childrend: file.files,
                    normalizeSize: normalize
                });
            }
        } else res.redirect('/');
    });
});

router.get('/:username/delete/:id', function (req, res) {
    FileModel.delete(req.params.id,
        // delete file in the folder
        function (err, file) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            let filepath = upload_dir + file.filename;

            rimraf(filepath, function (err) {
                if (err) throw err;
            });

            if (file.token) {
                file.token.remove();
            }
        },

        // deleting successfully
        function (file) {
            FileModel.updateOne({
                    _id: file.parent
                }, {
                    $pull: {
                        files: file._id
                    }
                },
                function (err, raw) {
                    res.redirect('/drive/' + req.params.username + '/view/' + req.session.currFolder.id);
                }
            );
        }
    );
});

router.delete('/:username/delete/:uuid', function (req, res) {
    FileModel.findOneAndDelete({
        uuid: req.params.uuid
    }).populate('token').exec(function (err, file) {
        if (err) throw err;
        if (file) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            let filepath = upload_dir + file.filename;

            rimraf(filepath, function (err) {
                if (err) throw err;
            });

            if (file.token) {
                file.token.remove();
            }

            FileModel.updateOne({
                    _id: file.parent
                }, {
                    $pull: {
                        files: file._id
                    }
                },
                function (err, raw) {
                    if (err) throw err;
                    res.status(200);
                    res.end();
                }
            );
        } else {
            res.status(500);
            res.end();
        }
    });
});

router.post('/:username/share/:id', function (req, res) {
    FileModel.findById(req.params.id, function (err, file) {
        if (!file.token) {
            let mailList = req.body["mailList[]"];
            let defaultDate = Date.now() + 86400000;
            let data = {
                id: req.params.id,
                expireIn: req.body.expireIn || defaultDate,
                owner: req.params.username,
            };

            let tokenStr = jws.sign({
                header: {
                    alg: config.algorithm
                },
                payload: JSON.stringify(data),
                secret: config.secret
            });

            let acceptedLocation = [req.body.location];
            let acceptedIp = [];

            let token = new TokenModel({
                tokenStr: tokenStr,
                expireIn: new Date(data.expireIn),
                belongTo: file._id,
                sharedWith: mailList,
                acceptedLocation: acceptedLocation,
                acceptedIp: acceptedIp
            });

            token.save().then(function (token) {
                file.token = token._id;
                file.save();

            }).catch(function (err) {
                console.error(err.message);
            });

            let mailOptions = {
                from: process.env.ETHEREAL_USER,
                to: mailList,
                subject: 'File Sharing',
                html: `<p>
                        You can access this file before ${token.expireIn.toLocaleString()}
                        <a href="http://${process.env.DOMAIN || 'localhost:3000'}/share/file/${tokenStr}">Link</a>
                        </p>`
            };

            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('Email sent: ' + info.response);
                res.status(200).end();
            });
        } else {
            res.status(200).end();
        }
    });
});

router.get('/:username/shared_files', function (req, res) {
    UserModel.findById(req.user.id)
        .populate({
            path: 'home',
            populate: ({
                path: 'files',
                populate: {
                    path: 'token'
                }
            })
        })
        .exec(function (err, user) {
            if (err) throw err;
            let files = user.home.files;
            let sharedFiles = [];

            files.forEach(file => {
                if (file.token) {
                    sharedFiles.push({
                        filename: file.filename,
                        expireIn: file.token.expireIn,
                        sharedWith: file.token.sharedWith,
                        views: file.token.views
                    });
                }
            });

            res.render('shared_file', {
                title: 'Shared files',
                username: req.params.username,
                sharedFiles: sharedFiles
            });
        });
});

router.get('/:username/shared_with_me', function (req, res) {
    res.render('shared_with_me', {
        title: 'Shared with me',
        username: req.params.username
    });
});

router.delete('/:username/cancel', function (req, res) {
    uploader.deleteTempChunkedFile(req.params.username, Object.keys(req.body)[0], function (err) {
        if (err) {
            console.error("Problem deleting file! " + err);
            res.status(500);
        }

        res.status(200).end('Be canceled!');
    });
});

module.exports = router;