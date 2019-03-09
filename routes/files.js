var rimraf = require('rimraf');
    router = require('express').Router(),
    FileModel = require('../models/File'),
    UserModel = require('../models/User'),
    multiparty = require('multiparty'),
    uploader = require('./upload-utils');

router.use(auth);
uploader.init({
    maxFileSize: 1e13, 
    uploadedFilesPath: __dirname + '/../uploads/'
});

router.get('/:username', function(req, res) {
    if (req.session.user.username === req.params.username) {
        UserModel.findById(req.session.user.id).populate('files').exec(function(err, user) {
            if (err) throw err;
            res.render('resource', {title: 'File Manager', username: req.params.username, files: user.files});
        });
    } else res.redirect('/user/login');
});

//New Folder
router.post('/:username/newFolder', function(req, res) {
    var folder = new FileModel({
        filepath: '/' + req.body.newFolder,
        owner: req.session.user.id
    });

    FileModel.newFolder(folder, function(err, folder) {
        if (err) throw err;
        UserModel.update(
            {_id: req.session.user.id},
            {$push: {files: folder._id}},
            function(err, raw) {
                if (err) throw err;
                res.redirect('/files/' + req.session.user.username);
            }
        );
    });
});

//Upload File
router.post('/:username/upload/', (req, res) => {
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
        var doc = new FileModel({
            uuid: file.uuid,
            filename: file.name,
            size: normalize(file.size),
            mimetype: file.mimetype,
            filepath: req.originalUrl,
            owner: req.session.user.id
        });

        doc.save().then(function(file) {
            UserModel.update(
                {_id: req.session.user.id},
                {$push: {files: file._id}},
                function(err, raw) {
                    if (err) throw err;
                }
            );
        });
    }
});

router.get('/:username/download/:id', function(req, res) {
    FileModel.findById(req.params.id, 'filename', function(err, file) {
        if (err) throw err;
        let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
        res.download(upload_dir + file.filename);
    });
});

router.get('/:username/preview/:id', function(req, res) {
    FileModel.findById(req.params.id, 'filename', function(err, file) {
        if (err) throw err;
        let upload_dir = __dirname + '/../uploads/' + req.params.username;
        res.sendFile(file.filename, {root: upload_dir});
    });
});

router.get('/:username/delete/:id', function(req, res) {
    FileModel.findOneAndDelete({_id: req.params.id}, function(err, file) {
        if (err) throw err;
        let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
        let filepath = upload_dir + file.filename;

        if (file.filename) {
            rimraf(filepath, function(err) {
                if (err) throw err;
            });
        }

        UserModel.update(
            {_id: file.owner}, 
            {$pull: {files: file._id}}, 
            function(err, raw) {
                if (err)  throw err;
                res.redirect('/files/' + req.params.username);
            }
        );
    });
});

router.delete('/:username/delete/:uuid', function(req, res) {
    FileModel.findOneAndDelete({uuid: req.params.uuid}, function(err, file) {
        if (err) throw err;
        if (file) {
            let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
            let filepath = upload_dir + file.filename;

            if (file.filename) {
                rimraf(filepath, function(err) {
                    if (err) throw err;
                });
            }

            UserModel.update(
                {_id: file.owner}, 
                {$pull: {files: file._id}}, 
                function(err, raw) {
                    if (err)  throw err;
                    res.status(200);
                    res.end();
                }
            );
        } else {
            res.status(204);
            res.end();
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

router.head('/:username/success', function(req, res) {
    /*
    if (req.get('OK')) res.redirect('/files/' + req.params.username);
    else {
        res.status(500);
        res.end('Failed onAllComplete callback!');
    }
    */

    console.log(req.get('OK'));
    res.redirect('/user/login');
    // res.end('Done');
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

function auth(req, res, next) {
    if (req.session.isLogined) next();
    else res.redirect('/user/login');
}


module.exports = router;
