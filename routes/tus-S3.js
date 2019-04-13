const AWS = require('aws-sdk'),
    tus = require('tus-node-server'),
    fs = require('fs'),
    express = require('express'),
    config = require('../config'),
    authen = require('../middleware/authen'),
    normalizeSize = require('../normalize').normalizeSize,
    router = express.Router();

/*
const EVENTS = tus.EVENTS;

const server = new tus.Server();

server.datastore = new tus.S3Store({
    path: '/',
    bucket: 'buckettest',
    partSize: 5 * 1024 * 1024,
    endpoint: config.S3.endpoint,
    accessKeyId: config.S3.accessKeyId,
    secretAccessKey: config.S3.secretAccessKey,
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: true,
});
*/

let s3Client = new AWS.S3({
    endpoint: config.S3.endpoint,
    accessKeyId: config.S3.accessKeyId,
    secretAccessKey: config.S3.secretAccessKey,
    sslEnabled: false,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
    s3DisableBodySigning: true,
});

let filename = [];
let multipart;
let id;
let upload_length;
let currUploadedSize = 0;
let multipartUpload = {
    Parts: []
};

router.use(authen.authenticate);
// router.use(server.handle.bind(server));

router.get('/', function(req, res) {
    let user = req.user;
    let data = [];
    res.render('tus/index', {title: 'Tus Upload', username: user.username, data: data, prettySize: normalizeSize});
});

router.post('/', function(req, res) {
    let tus_resumable = req.get('Tus-Resumable');
    upload_length = parseInt(req.get('Upload-Length'), 10);
    console.log(upload_length);
    let upload_defer_length = req.get('Upload-Defer-Length');

    let upload_metadata = req.get('Upload-Metadata');

    console.log(tus_resumable, upload_defer_length, upload_length, upload_metadata);
    
    let metadata = parseMetadataString(upload_metadata);
    id = parseInt(metadata.id.decoded, 10);

    filename.push(metadata.filename.decoded);

    s3Client.createMultipartUpload({
        Bucket: 'buckettest',
        Key: filename[0]
    }, function(err, _multipart) {
        multipart = _multipart;

        res.set({
            'Location': `${req.baseUrl}`,
            'Tus-Resumable': tus_resumable
        });

        res.status(201).end();
    });
});

router.patch('/', function(req, res) {
    let tus_resumable = req.get('Tus-Resumable');
    let offset = parseInt(req.get('Upload-Offset'), 10);
    let size = 0;

    let part = [];

    req.on('data', function(chunk) {
        part.push(chunk);
        size += chunk.length;
    });


    req.on('end', function() {
        let body = Buffer.concat(part, size);
        id++;
        console.log('---> Uploading part', id);
        s3Client.uploadPart({
            Bucket: 'buckettest',
            Key: filename[0],
            UploadId: multipart.UploadId,
            PartNumber: id,
            Body: body
        }, function(err, _part) {
            console.log('<--- Uploaded part', this.request.params.PartNumber, this.request.params.Body.length);
            currUploadedSize += size;
            multipartUpload.Parts.push({
                "ETag": _part.ETag,
                "PartNumber": this.request.params.PartNumber
            });

            if (currUploadedSize == upload_length) {
                s3Client.completeMultipartUpload({
                    Bucket: 'buckettest',
                    Key: filename[0],
                    UploadId: multipart.UploadId,
                    MultipartUpload: multipartUpload
                }, function(err, data) {
                    console.log('complete', data, err);
                })
            }
        });

        res.set({
            'Tus-Resumable': tus_resumable,
            'Upload-Offset': offset + size,
        });

        res.status(204).end();
    });
});

router.patch('/test', function(req, res) {
    let tus_resumable = req.get('Tus-Resumable');
    let offset = parseInt(req.get('Upload-Offset'), 10);

    let size = 0;

    let ws = fs.createWriteStream(__dirname + '/../' + `uploads/${filename[0]}`, {
        flags: 'a',
        encoding: 'utf8'
    });

    req.on('data', function(chunk) {
        size += chunk.length;
    });

    req.pipe(ws).on('finish', function() {
        res.set({
            'Tus-Resumable': tus_resumable,
            'Upload-Offset': offset + size,
        });

        res.status(204).end();
    });
});

function parseMetadataString(metadata_string) {
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

