module.exports = {
    secret: 'usingforJWT',

    // create token
    algorithm: 'HS256',
    secret: 'filesharing',

    // S3 config
    S3: {
        bucket: 'kingtalk-test',
        part_size: 1024 * 64, // 64 kb
        endpoint: 'http://103.69.195.227:8000',
        accessKeyId: 'BmCGbc51SPZJLlRQ',
        secretAccessKey: 'VonHdIrSxw1WQgSUaizdBrTdwIvSeOc0'
    },

    rtmpServer: ["rtmp://localhost:1935/live2", "rtmp://localhost:1935/live"],
    CDN_CONTROLLER_HOSTNAME: 'http://localhost:8000'
};
