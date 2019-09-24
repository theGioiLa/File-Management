const EventEmitter = require('events');
const util = require('util');

const MAX_UPLOAD_TRIES = 3;

module.exports = S3Uploader;

function S3Uploader(client) {
    if (this instanceof S3Uploader === false) {
        return new S3Uploader(client);
    }

    if (!client) {
        throw new Error('Must configure an S3 client before attempting to create an S3 upload stream.');
    }

    this.s3Client = client;
    EventEmitter.call(this)
}

util.inherits(S3Uploader, EventEmitter)

S3Uploader.prototype.done = function (err, data) {
    let self = this
    if (err) self.emit('error', error)
    else self.emit('done', data)
}

S3Uploader.prototype.uploadByStream = function (part, bucket, partSize) {
    let self = this;
    let s3Client = self.s3Client;

    s3Client.createMultipartUpload({
        Bucket: bucket,
        Key: part.filename,
        Metadata: {
            'Content-Type': part.headers['content-type']
        }
    }, function (err, multipart) {
        if (err) {
            console.error('Fail when create multipart upload:', err.message);
        } else {
            let receivedBuffers = [];
            let receivedBuffersLength = 0;

            // check complete
            let sentBytes = 0;
            let totalLength = 0;

            let partNumber = 1;

            let multipartUpload = {
                Parts: []
            };

            console.log('<-- created upload id', multipart.UploadId, multipart.Key);

            part.on('data', function (chunk) {
                totalLength += chunk.length;

                if (receivedBuffersLength < partSize) {
                    receivedBuffers.push(chunk);
                    receivedBuffersLength += chunk.length;
                } else {
                    receivedBuffers.push(chunk);
                    receivedBuffersLength += chunk.length;

                    let combinedBuffer = Buffer.concat(receivedBuffers, receivedBuffersLength);
                    receivedBuffers.length = 0;
                    receivedBuffersLength = 0;

                    let remainBuffer = Buffer.alloc(combinedBuffer.length - partSize);
                    combinedBuffer.copy(remainBuffer, 0, partSize);
                    receivedBuffers.push(remainBuffer);
                    receivedBuffersLength += remainBuffer.length;

                    let uploadBuffer = Buffer.alloc(partSize);
                    combinedBuffer.copy(uploadBuffer, 0, 0, partSize);

                    let partParams = {
                        Bucket: multipart.Bucket,
                        Key: multipart.Key,
                        UploadId: multipart.UploadId,
                        PartNumber: partNumber,
                        Body: uploadBuffer
                    };

                    console.log('--> uploading part', partNumber, uploadBuffer.length);
                    self.uploadPart(multipart, partParams, true);
                    partNumber++;
                }
            });

            self.on('part', function (part) {
                multipartUpload.Parts.push({
                    ETag: part.ETag,
                    PartNumber: part.PartNumber
                });

                sentBytes += part.Size;

                console.log('<-- uploaded part', part.PartNumber, part.Size);

                // complete multipart upload
                if (sentBytes == totalLength) {
                    let doneParams = {
                        Bucket: multipart.Bucket,
                        Key: multipart.Key,
                        UploadId: multipart.UploadId,
                        MultipartUpload: multipartUpload
                    }

                    self.completeMultipartUpload(doneParams);
                }
            });

            part.on('end', function () {
                if (receivedBuffersLength > 0) {
                    let uploadBuffer = Buffer.concat(receivedBuffers, receivedBuffersLength);
                    receivedBuffers.length = 0;
                    receivedBuffersLength = 0;

                    let partParams = {
                        Bucket: multipart.Bucket,
                        Key: multipart.Key,
                        UploadId: multipart.UploadId,
                        PartNumber: partNumber,
                        Body: uploadBuffer
                    };

                    console.log('--> uploading part', partNumber, uploadBuffer.length);
                    self.uploadPart(multipart, partParams, true);
                }
            });
        }
    });

    part.on('error', function (err) {
        self.abortAllMultipartUpload(bucket);
        console.error('Part Error:', err.message);
    });
}

S3Uploader.prototype.uploadByBuffer = function (buffer, bucket, key, partSize, content_type) {
    let self = this;
    let s3Client = self.s3Client;

    s3Client.createMultipartUpload({
        Bucket: bucket,
        Key: key,
        Metadata: {
            'Content-Type': content_type
        }
    }, function (err, multipart) {
        if (err) {
            console.error('Fail when create multipart upload:', err.message);
        } else {
            console.log('Created multipart upload with UploadId: ', multipart.UploadId);

            let partNumber = 1;

            multipart.pendingPartNum = Math.ceil(buffer.length / partSize);
            multipart.multipartUpload = {
                Parts: []
            };

            for (let start = 0; start < buffer.length; start += partSize) {
                let end = Math.min(start + partSize, buffer.length);
                let partParams = {
                    Bucket: multipart.Bucket,
                    Key: multipart.Key,
                    PartNumber: partNumber,
                    UploadId: multipart.UploadId,
                    Body: buffer.slice(start, end)
                }

                partNumber++;
                self.uploadPart(multipart, partParams);
            }
        }
    });
}

S3Uploader.prototype.upload = function (part, bucket) {
    let s3Client = this.s3Client;

    let uploadParams = {
        Bucket: bucket,
        Key: part.filename,
        Body: part,
        Metadata: {
            'Content-Type': part.headers['content-type']
        }
    };

    let upload = s3Client.upload(uploadParams);
    upload.on('httpUploadProgress', function (progress) {
        console.log('Uploading', data);
    });

    upload.send(function (err, data) {
        if (err) console.log("Error :", err.code, err.message);
        else console.log('Uploaded ', data);
    });
}

S3Uploader.prototype.uploadPart = function (multipart, partParams, byStream, tryNum) {
    let self = this;
    let s3Client = self.s3Client;

    tryNum = tryNum || 1;

    s3Client.uploadPart(partParams, function (partErr, part) {
        if (partErr) {
            console.error('upload part error: ', partErr.message);
            if (tryNum < MAX_UPLOAD_TRIES) {
                console.log('Retrying upload of part: #', partParams.PartNumber);
                self.uploadPart(multipart, partParams, true, tryNum + 1);
            } else {
                let abortParams = {
                    Bucket: multipart.Bucket,
                    Key: multipart.Key,
                    UploadId: multipart.UploadId
                };

                console.error('Failed uploading part: #', partParams.PartNumber);
                self.abortMultipartUpload(abortParams);
                // s3Client.abortMultipartUpload(abortParams).send();
            }
        } else {
            if (byStream) { // used for upload by stream
                let _partId = {
                    ETag: part.ETag,
                    PartNumber: this.request.params.PartNumber,
                    Size: this.request.params.Body.length
                };

                self.emit('part', _partId);
            } else { // be used for upload by buffer

                multipart.multipartUpload.Parts[this.request.params.PartNumber - 1] = {
                    ETag: part.ETag,
                    PartNumber: this.request.params.PartNumber
                };

                console.log('uploaded part', this.request.params.PartNumber, this.request.params.Key, this.request.params.Body.length);

                if (--multipart.pendingPartNum > 0) return;

                // Completed multipart upload request
                let doneParams = {
                    Bucket: multipart.Bucket,
                    Key: multipart.Key,
                    UploadId: multipart.UploadId,
                    MultipartUpload: multipart.multipartUpload
                }

                self.completeMultipartUpload(doneParams);
            }
        }
    });
};

S3Uploader.prototype.completeMultipartUpload = function (doneParams) {
    let self = this;
    let s3Client = self.s3Client;
    s3Client.completeMultipartUpload(doneParams, function (err, data) {
        if (err) {
            let abortParams = {
                Bucket: doneParams.Bucket,
                Key: doneParams.Key,
                UploadId: doneParams.UploadId
            };

            self.abortMultipartUpload(abortParams);
            console.error('Complete Error: ', err.code, err.message);
            self.done(err);
        } else {
            console.log('Completed upload', data.Key, 'in', data.Bucket);
            self.done(null, {
                data: {
                    key: data.key,
                    bucket: data.Bucket
                }
            });
        }
    });
}

S3Uploader.prototype.abortAllMultipartUpload = function (bucket) {
    let s3Client = this.s3Client;
    s3Client.listMultipartUploads({
        Bucket: bucket
    }, function (err, data) {
        data.Uploads.forEach(function (multipartUpload) {
            let abortParams = {
                Bucket: data.Bucket,
                Key: multipartUpload.Key,
                UploadId: multipartUpload.UploadId
            };

            s3Client.abortMultipartUpload(abortParams).send();
        });
    });
}

S3Uploader.prototype.abortMultipartUpload = function (abortParams) {
    let s3Client = this.s3Client;
    s3Client.abortMultipartUpload(abortParams)
        .on('complete', function (res) {
            console.log('Freed uploaded Parts in', abortParams.UploadId);
        })
        .send();
}