const AWS = require('aws-sdk'),
    fs = require('fs'),
    express = require('express'),
    config = require('../config'),
    authen = require('../middleware/authen'),
    normalizeSize = require('../normalize').normalizeSize,
    router = express.Router();

const PART_SIZE = 5 * 1024 * 1024,
    BUCKET_NAME = 'buckettest';

let s3Client = new AWS.S3({
    endpoint: config.S3.endpoint,
    accessKeyId: config.S3.accessKeyId,
    secretAccessKey: config.S3.secretAccessKey,
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: true,
});

let fileQueue = [];

router.use(authen.authenticate);
// router.use(server.handle.bind(server));

router.get('/', function (req, res) {
    let user = req.user;
    let options = {
        Bucket: BUCKET_NAME,
    };

    // s3Uploader.abortAllMultipartUpload(BUCKET_NAME);

    s3Client.listObjects(options, function (err, data) {
        if (err) {
            console.error(err);
            res.status(err.statusCode).end(err.message);
        }
        else {
            let body = [];
            let headReqs = [];
            data.Contents.forEach(function(_file) {
                headReqs.push(
                    s3Client.headObject({
                        Bucket: BUCKET_NAME, 
                        Key: _file.Key
                    })
                    .promise()
                    .then(function(metadata) {
                        let file = Object.assign({}, _file, {contentType: metadata.Metadata['content-type']});
                        body.push(file);
                    })
                    .catch(function(err) {
                        Console.error(err);
                        res.status(err.statusCode).end(err.message);
                    })
                );
            });

            Promise.all(headReqs).then(function() {
                res.render('tus/index', {
                    title: 'Tus S3 Upload',
                    username: user.username,
                    data: body,
                    prettySize: normalizeSize
                });
            });
        }
    });
});

router.post('/', function (req, res) {
    let tus_resumable = req.get('Tus-Resumable');
    upload_length = parseInt(req.get('Upload-Length'), 10);
    let upload_defer_length = req.get('Upload-Defer-Length');

    let upload_metadata = req.get('Upload-Metadata');

    let metadata = parseMetadataString(upload_metadata);

    let file = {
        id: metadata.id.decoded,
        filename: metadata.filename.decoded,
        filetype: metadata.filetype.decoded,
        size: upload_length,
        currUploadedSizeToS3: 0,
        currUploadedSizeToMe: 0,
        multipartUpload : {
            Parts: []
        },
        metadata: upload_metadata
    };

    fileQueue[file.id] = file;

    s3Client.createMultipartUpload({
        Bucket: BUCKET_NAME,
        Key: file.filename,
        Metadata: {
            'Content-Type': file.filetype
        }
    }, function (err, _multipart) {
        file.multipart = _multipart;

        console.log('Filename:', file.filename);
        res.set({
            'Location': `${req.baseUrl}/${file.id}`,
            'Tus-Resumable': tus_resumable
        });

        res.status(201).end();
    });
});

router.head('/:id', function(req, res) {
    let file = fileQueue[req.params.id];
 
    res.set({
        'Cache-control': 'no-store',
        'Upload-Length': file.size,
        'Upload-Metadata': file.metadata,
        'Upload-Offset': file.currUploadedSizeToMe
    });

    res.status(200).end();
});

router.patch('/:id', function (req, res) {
    let id = req.params.id;
    let file = fileQueue[id];


    let tus_resumable = req.get('Tus-Resumable');
    let offset = parseInt(req.get('Upload-Offset'), 10);
    let size = 0;

    let part = [];

    req.on('data', function (chunk) {
        part.push(chunk);
        size += chunk.length;
    });

    req.on('end', function () {
        let body = Buffer.concat(part, size);
        let partNumber = Math.ceil((offset + size) / PART_SIZE);
        if (partNumber == 0) partNumber++;

        console.log('---> Uploading part', partNumber, file.filename);
        s3Client.uploadPart({
            Bucket: BUCKET_NAME,
            Key: file.filename,
            UploadId: file.multipart.UploadId,
            PartNumber: partNumber,
            Body: body,
        }, function (err, _part) {
            if (err) {
                console.error(err);
                return res.status(400).end(err.message);
            }
            console.log('<--- Uploaded part', this.request.params.PartNumber, this.request.params.Body.length, this.request.params.Key);
            file.multipartUpload.Parts.push({
                "ETag": _part.ETag,
                "PartNumber": this.request.params.PartNumber
            });

            file.currUploadedSizeToS3 += size;

            if (file.currUploadedSizeToS3 == file.size) {
                s3Client.completeMultipartUpload({
                    Bucket: BUCKET_NAME,
                    Key: file.filename,
                    UploadId: file.multipart.UploadId,
                    MultipartUpload: file.multipartUpload
                }, function (err, data) {
                    if (err) {
                        console.error(err);
                        return ;
                    }
                    console.log('<--- Complete', data);
                })
            }

        });

        file.currUploadedSizeToMe += size;

        res.set({
            'Tus-Resumable': tus_resumable,
            'Upload-Offset': offset + size,
        });

        res.status(204).end();
    });
});

router.patch('/test/:id', function (req, res) {
    let tus_resumable = req.get('Tus-Resumable');
    let offset = parseInt(req.get('Upload-Offset'), 10);

    let file = fileQueue[req.params.id];

    let size = 0;

    let ws = fs.createWriteStream(__dirname + '/../' + `uploads/${file.filename}`, {
        flags: 'a',
        encoding: 'utf8'
    });

    req.on('data', function (chunk) {
        size += chunk.length;
    });

    req.pipe(ws).on('finish', function () {
        res.set({
            'Tus-Resumable': tus_resumable,
            'Upload-Offset': offset + size,
        });

        res.status(204).end();
    });
});

function parseMetadataString(metadata_string) {
    console.log(metadata_string);
    const kv_pair_list = metadata_string.split(',');

    return kv_pair_list.reduce((metadata, kv_pair) => {
        const [key, base64_value] = kv_pair.split(' ');

        metadata[key] = {
            encoded: base64_value,
            decoded: Buffer.from(base64_value, 'base64').toString('ascii'),
        };

        return metadata;
    }, {});
}

module.exports = router;