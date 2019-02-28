var multer = require('multer');
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

var upload = multer({storage: storage});

router.get('/:username', function(req, res) {
    if (req.session.isLogined && req.session.user.username === req.params.username) {
        UserModel.findById(req.session.user.id).populate('files').exec(function(err, user) {
            if (err) throw err;
            res.render('file_manager', {title: 'File Manager', username: req.params.username, files: user.files});
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
                res.redirect(req.session.user.username);
            }
        );
    });
});

//Upload File
router.post('/:username/upload/', upload.array('upload', 12), (req, res, next) => {
    var files = req.files;

    var arrFile = [];
    files.forEach(function(file) {
        var doc = new FileModel({
            filename: file.originalname.split(' ').join(''),
            size: file.size,
            mimetype: file.mimetype,
            filepath: req.originalUrl,
            owner: req.session.user.id
        });

        arrFile.push(doc);
    });

    FileModel.newFile(arrFile, function(err, files) {
        if (err) throw err;
        files.forEach(function(file) {
            UserModel.update(
                {_id: req.session.user.id},
                {$push: {files: file._id}},
                function(err, raw) {
                    if (err) throw err;
                }
            );
        });

        res.redirect('/files/'+req.params.username);
    });
});

router.get('/:username/download/:filename', function(req, res) {
    res.download('uploads/' + req.params.filename);
});

router.delete('/:username/delete/:filename', function(req, res) {
    fs.unlink('uploads/' + req.params.filename);
    FileModel.delete(req.params.filename, function(err, doc) {
        UserModel.update(
            {_id: doc.owner}, 
            {$pull: {files: doc._id}}, 
            function(err, raw) {
               if (err)  throw err;
               res.redirect(req.params.username);
            }
        );
    });
});

router.get('/:username/:dir', function(req, res) {

});

module.exports = router;
