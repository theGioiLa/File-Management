var multer = require('multer');
var fs = require('fs');
var router = require('express').Router();
var FileModel = require('../models/File');
var UserModel = require('../models/User');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },

    filename: (req, file, cb) => {
        cb(null, file.originalname.split(' ').join(''));
    }
});

const MAX_FILENO = 12;
var upload = multer({storage: storage}).array('upload', MAX_FILENO);

router.use(auth);

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
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) throw err;
        else if (err) throw err;
        else {
            var files = req.files;

            var arrFile = [];
            files.forEach(function(file) {
                var doc = new FileModel({
                    filename: file.originalname.split(' ').join(''),
                    size: normalize(file.size),
                    mimetype: file.mimetype,
                    filepath: req.originalUrl,
                    owner: req.session.user.id
                });

                arrFile.push(doc);
            });

            FileModel.newFile(arrFile, function(err, files) {
                if (err) throw err;
                let index = 0;

                files.forEach(function(file) {
                    UserModel.update(
                        {_id: req.session.user.id},
                        {$push: {files: file._id}},
                        function(err, raw) {
                            if (err) throw err;
                            index++;

                            // Xu li van de khong dong bo giua update User va redirect ve dashboard
                            if (index == files.length) res.redirect('/files/' + req.params.username);
                        }
                    );
                });


            });
        }
    });

});

router.get('/:username/download/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/';
    res.download(upload_dir + req.params.filename);
});

router.get('/:username/preview/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/'; 
    let filename = req.params.filename;
    res.sendFile(filename, {root: upload_dir});
});

router.get('/:username/delete/:filename', function(req, res) {
    let upload_dir = __dirname + '/../uploads/';
    let file = upload_dir + req.params.filename;
    fs.access(file, fs.constants.F_OK, function(err) {
        if (!err) {
            fs.unlink(file);
            FileModel.delete(req.params.filename, false, function(err, doc) {
                if (err) throw err;
                console.log(doc);
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
