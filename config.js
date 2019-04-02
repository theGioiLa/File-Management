const {EventEmitter} = require('events');
module.exports = {
    secret: 'usingforJWT',

    // create token
    algorithm: 'HS256',
    secret: 'filesharing',

    // S3 config
    S3: {
        endpoint: 'http://103.69.195.227:8000',
        accessKeyId: 'BmCGbc51SPZJLlRQ',
        secretAccessKey: 'VonHdIrSxw1WQgSUaizdBrTdwIvSeOc0'
    }
};
