const AWS = require('aws-sdk'),
    express = require('express'),
    multiparty = require('multiparty'),
    config = require('../config'),
    router = express.Router(),
    fs = require('fs'),
    authen = require('../middleware/authen'),
    S3Uploader = require('./S3-utils'),
    normalizeSize = require('../normalize').normalizeSize;

router.use(authen.authenticate);

let s3Client = new AWS.S3({
    endpoint: config.S3.endpoint,
    accessKeyId: config.S3.accessKeyId,
    secretAccessKey: config.S3.secretAccessKey,
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: true,
});

const BUCKET_NAME = 'buckettest',
    PART_SIZE = 1024 * 1024 * 5;

let s3Uploader = S3Uploader(s3Client);

router.get('/', function(req, res) {
    let user = req.user;
    let options = {
        Bucket: BUCKET_NAME,
    };

    s3Client.listObjects(options, function(err, data) {
        if (err) console.error(err);
        else {
            res.render('S3/index', {title: 'S3 Upload', username: user.username, data: data.Contents, prettySize: normalizeSize});
        }
    });
});

router.post('/upload', function(req, res) {
    let form = new multiparty.Form();

    form.on('part', function(part) {
        if (part.filename) {
            s3Uploader.upload(part, BUCKET_NAME);
        }
    });

    form.on('close', function() {
        res.redirect('/S3');
    });

    form.on('error', function(err) {
        console.error('Multiparty form error: ', err.message);
    });

    form.parse(req);
});

router.post('/upload/buffer', function(req, res) {
    let form = new multiparty.Form();

    form.on('part', function(part) {
        if (part.filename) {
            let receivedBuffers = [];
            let receivedBuffersLength = 0;

            part.on('data', function(chunk) {
                receivedBuffers.push(chunk);
                receivedBuffersLength += chunk.length;
            });

            part.on('end', function() {
                let buffer = Buffer.concat(receivedBuffers, receivedBuffersLength);
                s3Uploader.uploadByBuffer(buffer, BUCKET_NAME, part.filename, PART_SIZE);
            });

            part.on('error', function(err) {
                console.error('Part Error:', err.message);
            });
        }
    });

    form.on('close', function() {
        res.redirect('/S3');
    });

    form.on('error', function(err) {
        console.error('Form Error:', err.message);
    });

    form.parse(req);
});

router.post('/upload/stream', function(req, res) {
    let form = new multiparty.Form();

    form.on('part', function(part) {
        if (part.filename) {
            s3Uploader.uploadByStream(part, BUCKET_NAME, PART_SIZE);;
        }
    });

    form.on('error', function(err) {
        abortAllMultipartUpload();
        console.error('Form Error:', err.message);
    });

    form.on('close', function() {
        res.redirect('/S3');
    });

    form.parse(req);
});

router.post('/delete', function(req, res) {
   let key = req.body.Key;

   console.log(key);

   let deleteParams = {
       Bucket: BUCKET_NAME,
       Key: key
   };

   s3Client.deleteObject(deleteParams, function(err, data) {
       if (err) console.log('Delete Error: ', err.message);
       else {
           res.status(200).send('Delete Ok');
       }
   });
});

module.exports = router;
