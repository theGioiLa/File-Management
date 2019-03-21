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
    authen = require('../middleware/authen');

let transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port:  587,
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

router.get('/:username', function(req, res) {
    if (req.session.user.username === req.params.username) {
        UserModel.findById(req.session.user.id)
            .populate({
                path: 'home',
                populate: {path: 'files'}
            })
            .exec(function(err, user) {
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
                    normalizeSize: normalize}
                );
            });
    } else res.redirect('/user/login');
});

//New Folder
router.post('/:username/newFolder', function(req, res) {
    var folder = new FileModel({
        filename: req.body.newFolder,
        filepath: req.session.currFolder.path + '/' + req.body.newFolder,
        parent: req.session.currFolder.id,
        isFolder: true,
        owner: req.session.user.id
    });

    FileModel.newFolder(folder, function(err, folder) {
        if (err) throw err;
        FileModel.updateOne(
            {_id: req.session.currFolder.id},
            {$push: {files: folder._id}},
            function(err, raw) {
                if (err) throw err;
                res.redirect('/drive/' + req.params.username + '/view/' + req.session.currFolder.id);
            }
        );
    });
});

//Upload File
router.post('/:username/upload', (req, res) => {
    var form = new multiparty.Form();

    form.parse(req, function(err, fields, files) {
        if (err) return;
        
        var partIndex = fields.qqpartindex;
        var file = files.qqfile[0];
        var owner = req.params.username;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");
        
        if (partIndex == null) {
            file.mimetype = file.headers['content-type'];
            uploader.onSimpleUpload(fields, file, owner, res, onSaved); 
        }
        else {
            uploader.onChunkedUpload(fields, file, owner, res, onSaved);
        }
    });

    function onSaved(file) {
        FileModel.find({filename: file.name}, function(err, files) {
            if (files.length == 0) {
                var doc = new FileModel({
                    uuid: file.uuid,
                    filename: file.name,
                    size: file.size,
                    mimetype: file.mimetype,
                    parent: req.session.currFolder.id,
                    owner: req.session.user.id
                });

                doc.save().then(function(file) {
                    FileModel.updateOne(
                        {_id: file.parent},
                        {$push: {files: file._id}},
                        function(err, raw) {
                            if (err) throw err;
                        }
                    );
                });

            }
        });
    }
});

router.get('/:username/download/:id', function(req, res) {
    FileModel.findById(req.params.id, 'filename', function(err, file) {
        if (err) throw err;
        if (!file.isFolder) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            res.download(upload_dir + file.filename);
        } else {
            res.end('Cannot donwload this folder!');
        }
    });
});

router.get('/:username/view/:id', function(req, res) {
    FileModel.findById(req.params.id).populate('files').exec(function(err, file) {
        if (err) throw err;
        if (file) {
            if (!file.isFolder) { // view File
                let upload_dir = __dirname + '/../uploads/' + req.params.username;
                res.set({
                    'Content-Type': file.mimetype,
                    'Content-Length': file.size,
                });
                res.sendFile(file.filename, {root: upload_dir});
            } else { // view Folder
                req.session.currFolder.path = file.filepath;
                req.session.currFolder.id = file._id;

                res.render('resource', {
                    title: 'File Manager', 
                    username: req.params.username, 
                    currDir_path: file.filepath, 
                    parent: file.parent, 
                    childrend: file.files, 
                    normalizeSize: normalize}
                );
            }
        } else res.redirect('/user/login');
    });
});

router.get('/:username/delete/:id', function(req, res) {
    FileModel.delete(req.params.id, 
        // delete file in the folder
        function(err, file) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            let filepath = upload_dir + file.filename;

            rimraf(filepath, function(err) {
                if (err) throw err;
            });

            TokenModel.deleteOne({owner: file._id}, function(err) {
                if (err) {
                    console.error(err.message);
                    return;
                }
            });
        },

        // deleting successfully
        function(file) {
            FileModel.updateOne(
                {_id: file.parent},
                {$pull: {files: file._id}},
                function(err, raw) {
                    res.redirect('/drive/' + req.params.username + '/view/' + req.session.currFolder.id);
                }
            );
        }
    );
});

router.delete('/:username/delete/:uuid', function(req, res) {
    FileModel.findOneAndDelete({uuid: req.params.uuid}, function(err, file) {
        if (err) throw err;
        if (file) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            let filepath = upload_dir + file.filename;

            rimraf(filepath, function(err) {
                if (err) throw err;
            });

            TokenModel.deleteOne({owner: file._id}, function(err) {
                if (err) {
                    console.error(err.message);
                    return;
                }
            });

            FileModel.updateOne(
                {_id: file.parent}, 
                {$pull: {files: file._id}}, 
                function(err, raw) {
                    if (err)  throw err;
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

router.post('/:username/share/:id', function(req, res) {
    FileModel.findById(req.params.id, function(err, file) {
        if (!file.token) {
            let data = JSON.stringify({
                id: req.params.id,
                expireIn: parseInt(req.body.expireIn), // seconds
                owner: req.params.username
            });

            //let token = jwt.sign({id: req.params.id, owner: req.params.username}, process.env.SECRET, options);
            let token = jws.sign({
                header: {alg: config.algorithm},
                payload: data,
                secret: config.secret
            });

            file.token = token;
            file.expireIn = parseInt(req.body.expireIn);
            file.save();

            let mailOptions = {
                from: process.env.ETHEREAL_USER,
                to: 'quangquyK60@gmail.com',
                subject: 'File Sharing',
                html: `<p>You can access this file <a href='${process.env.DOMAIN || 'localhost'}:3000/share/file/${token}'>Link</a></p>`
            }

            transporter.sendMail(mailOptions, function(err, info) {
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

router.delete('/:username/cancel', function(req, res) {
    uploader.deleteTempChunkedFile(req.params.username, Object.keys(req.body)[0], function(err) {
        if (err) {
            console.error("Problem deleting file! " + err);
            res.status(500);
        }

        res.end('Be canceled!'); 
    });
});

function normalize(fileSizeInBytes) {
    let i = -1;
    let byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1000;
        i++;
    } while (fileSizeInBytes > 1000);

    return Math.max(fileSizeInBytes, 0.1).toFixed(2) + byteUnits[i];
}

module.exports = router;
