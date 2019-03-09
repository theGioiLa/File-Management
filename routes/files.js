var fs = require('fs'),
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
            uuid: file.qquuid,
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

router.get('/:username/download/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
    res.download(upload_dir + req.params.filename);
});

router.get('/:username/preview/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/' + req.params.username;
    let filename = req.params.filename;
    res.sendFile(filename, {root: upload_dir});
});

router.get('/:username/delete/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/' + req.params.username + '/';
    let file = upload_dir + req.params.filename;
    fs.access(file, fs.constants.F_OK, function(err) {
        if (!err) {
            fs.unlink(file);
            FileModel.delete(req.params.filename, false, function(err, doc) {
                if (err) throw err;
                UserModel.update(
                    {_id: doc.owner}, 
                    {$pull: {files: doc._id}}, 
                    function(err, raw) {
                        if (err)  throw err;
                        res.redirect('/files/' + req.params.username);
                    }
                );
            });
        } else {
            FileModel.delete('/' + req.params.filename, true, function(err, doc) {
                if (err) throw err;
                if (!doc) {
                    res.redirect('/files/' + req.params.username);
                    return;
                }
                UserModel.update(
                    {_id: doc.owner}, 
                    {$pull: {files: doc._id}}, 
                    function(err, raw) {
                    if (err)  throw err;
                        res.redirect('/files/' + req.params.username);
                    }
                );
            });
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
    if (req.get('OK')) res.render('/files/' + req.params.username);
    else {
        res.status(500);
        res.end('Failed onAllComplete callback!');
    }
});


function normalize(fileSizeInBytes) {
    let i = -1;
    let byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(2) + byteUnits[i];
}

function auth(req, res, next) {
    if (req.session.isLogined) next();
    else res.redirect('/user/login');
}


module.exports = router;
