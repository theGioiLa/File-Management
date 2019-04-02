const AWS = require('aws-sdk'),
    rimraf = require('rimraf'),
    mkdirp = require('mkdirp'),
    express = require('express'),
    multiparty = require('multiparty'),
    config = require('../config'),
    router = express.Router(),
    fs = require('fs'),
    authen = require('../middleware/authen');

// router.use(authen.authenticate);

const BUCKET_NAME = 'buckettest';
const S3_TMP_PATH = __dirname + '/../uploads/S3_tmp';
const MAX_UPLOAD_TRIES = 1;
const PART_SIZE = 1024 * 1024 * 6;

let startTime = Date.now();
let multipartUpload = {
    Parts: []
}

let s3Client = new AWS.S3({
    endpoint: config.S3.endpoint,
    accessKeyId: config.S3.accessKeyId,
    secretAccessKey: config.S3.secretAccessKey,
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: true,
});

router.get('/', function(req, res) {
    let user = req.session.user;
    let options = {
        Bucket: BUCKET_NAME,
    };

    s3Client.listObjects(options, function(err, data) {
        if (err) console.error(err);
        else {
            res.render('S3/index', {title: 'S3 Upload', username: user.username, data: data.Contents});
        }
    });
});

router.post('/upload/stream', function(req, res) {
    let form = new multiparty.Form();

    form.on('part', function(part) {
        if (part.filename) {
            console.log('filename', part.filename);
            s3Client.upload({
                Bucket: BUCKET_NAME,
                Key: part.filename,
                Body: part,
                ContentLength: part.byteCount,
                ContentType: part.headers['content-type']
            }, function(err, data) {
                console.log(data);
            })
        }

        part.on('end', function() {
            res.end('Ok');
        })

        part.on('error', function(err) {
            console.error(err);
        })

    });

    form.parse(req);
});

router.post('/upload/multipart', function(req, res) {
    let form = new multiparty.Form();

    form.on('file', function(name, file) {
        let buffer = fs.readFileSync(file.path);

        s3Client.createMultipartUpload({
            Bucket: BUCKET_NAME,
            Key: file.originalFilename, 
            ContentType: file.headers['content-type']
        }, function(err, multipart) {
            if (err) console.error(err);
            else {
                console.log('Created multipart upload Id: ', multipart.UploadId);

                let partNumber = 1;
                multipart.pendingPartNum = Math.ceil(file.size/PART_SIZE);

                for (let start = 0; start < buffer.length; start+=PART_SIZE) {
                    let end = Math.min(start + PART_SIZE, buffer.length);
                    let partParams = {
                        Bucket: multipart.Bucket,
                        Key: multipart.Key,
                        PartNumber: partNumber,
                        UploadId: multipart.UploadId,
                        Body: buffer.slice(start, end)
                    }

                    console.log("=========", start, partParams.Body.length);
                    partNumber++;
                    uploadPart(multipart, partParams, function(partNumber) {
                        console.log('Uploaded part: #', partNumber, 'Size: ', partParams.Body.length);
                    });
                }
            }
        });
    });

    form.on('close', function() {
        res.end('Ok');
    });

    form.parse(req);
});


function uploadPart(multipart, partParams, onPartSuccess, tryNum) {
    tryNum = tryNum || 1;
    
    s3Client.uploadPart(partParams, function(partErr, part) {
        if (partErr) {
            console.log("++++++++", partParams.PartNumber, partParams);
            console.error('upload part error: ', partErr.message);
            if (tryNum < MAX_UPLOAD_TRIES) {
                console.log('Retrying upload of part: #', partParams.PartNumber);
                uploadPart(multipart, partParams, onPartSuccess, tryNum + 1);
            } else {
                console.error('Failed uploading part: #', partParams.PartNumber);
            }
        } else {
            console.log(this.request.params);

            multipartUpload.Parts[this.request.params.PartNumber - 1] = {
                ETag: part.ETag,
                PartNumber: Number(this.request.params.PartNumber)
            };

            console.log('Completed part ', this.request.params.PartNumber);
            if (--multipart.pendingPartNum > 0) {
                onPartSuccess(partParams.PartNumber);
                return;   
            }

            // Completed multipart upload request
            let doneParams = {
                Bucket: multipart.Bucket, 
                Key: multipart.Key,
                UploadId: multipart.UploadId,
                MultipartUpload: multipartUpload
            }

            completeMultipartUpload(doneParams, function() {
            });
        }
    });
};

function completeMultipartUpload(doneParams, onComplete) {
    s3Client.completeMultipartUpload(doneParams, function(err, data) {
        if (err) {
            console.error(err);
        } else {
            var delta = (Date.now() - startTime)/1000;
            console.log('Completed upload in ', delta, 's');
            console.log(data);
            onComplete();
        }
    });
}


module.exports = router;
