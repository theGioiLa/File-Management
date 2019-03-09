var router = require('express').Router();
var multiparty = require('multiparty'),
    uploader = require('./upload-utils');

uploader.init({maxFileSize: 1e20});

router.get('/', function(req, res) {
    res.render('fine');
});

router.get('/session', function(req, res) {
    console.log(req.body);
    console.log(req.params);
    console.log(req.query);
});

router.post('/success', function(req, res) {
    console.log(req.body);
    res.end('Done');
});

/*
           
            */
router.post('/uploads', function(req, res) {
    var form = new multiparty.Form();

    form.parse(req, function(err, fields, files) {
        if (err) {
            return;
        }

        // if received file/chunked 
        var partIndex = fields.qqpartindex;
        req.session.currentUUID = fields.qquuid;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");

        if (partIndex == null) {
            uploader.onSimpleUpload(fields, files['qqfile'][0], res);
        }
        else {
            uploader.onChunkedUpload(fields, files['qqfile'][0], res);
        }
    });
});

router.delete('/uploads/:uuid', function(req, res) {
    var uuid = req.params.uuid;
    console.log(req.params);

    uploader.delete(uuid, function(err) {
        if (err) {
            console.error("Problem deleting file! " + err);
            res.status(500);
        }

        res.sendStatus(200);
    });
});

router.delete('/cancel', function(req, res) {
    uploader.delete(Object.keys(req.body)[0], function(err) {
        if (err) {
            console.error("Problem deleting file! " + err);
            res.status(500);
        }

        res.end('Be canceled!'); 
    });
});

module.exports = router;