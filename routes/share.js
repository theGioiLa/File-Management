const router = require('express').Router(),
    FileModel = require('../models/File'),
    jws = require('jws');

router.get('/file/:token', function(req, res) {
    let token = req.params.token;

    if (jws.verify(token, config.algorithm, config.secret)) {
        let data = JSON.parse(jws.decode(token).payload);

        FileModel.findById(data.id, function(err, file) {
            if (err) {
                console.error(err);
                return;
            }

            if (file) {
                if (!file.isStartTimer) {
                    file.isStartTimer

                }
                let upload_dir = __dirname + '/../uploads/' + data.owner; 

                res.set({
                    'Content-Type': file.mimetype,
                    'Content-Length': file.size,
                });

                res.sendFile(file.filename, {root: upload_dir});
            } else {
                res.status(400).json("File doesn't exist!");
            }
        });
    } else {
        res.status(401).send("You cannot access this file!");
    }
});

module.exports = router;