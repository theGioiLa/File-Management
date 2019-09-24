// Trigger from rtmpServer

const fs = require('fs'),
    config = require('../../config'),
    http = require('http');

const DATA_TYPE = {
    FOLDER_CREATE_SIG: 0,
    FILE: 1,
    FOLDER_REMOVE_SIG: 2
};

const log = console.log.bind(console),
    error = console.error.bind(console);

let CDNActive_L = [];

http.get(`${config.CDN_CONTROLLER_HOSTNAME}/cdn-list`, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let _error;
    if (statusCode !== 200) {
        _error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
    } else if (!/^application\/json/.test(contentType)) {
        _error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
    }
    if (_error) {
        error(_error.message);
        // Consume response data to free up memory
        res.resume();
        return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            CDNActive_L = JSON.parse(rawData);
            log(CDNActive_L);
            startTracking();
        } catch (e) {
            error(e.message);
        }
    })
}).on('error', (e) => {
    error(`Got error: ${e.message}`);
});

function sendData(data, dataType, cb) {
    const postData = data;

    CDNActive_L.forEach(cdnAddress => {
        let [_host, _port] = cdnAddress.split(':');
        log(_host, _port)
        const options = {
            host: _host,
            port: _port,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Data-Type': dataType,
            }
        };

        const req = http.request(options, (res) => {
            res.on('data', (chunk) => {
                log(`BODY: ${chunk}`);
            });

            res.on('end', function () {
                if (cb) cb();
            })
        });

        req.on('error', (e) => {
            error(`problem with request: ${e.message}`);
        });

        // Write data to request body
        req.write(postData);
        req.end();
    })
}

function sendFile(path_to_file, cb) {
    fs.readFile(path_to_file, function (err, data) {
        let arr = path_to_file.split('/');
        let streamKey = arr[arr.length - 2];
        let filename = arr[arr.length - 1];
        let filenameBuff = Buffer.from(`hls/${streamKey}/${filename}\r\n`);

        let postData = Buffer.concat([filenameBuff, data], filenameBuff.length + data.length);

        sendData(postData, DATA_TYPE.FILE, cb);
        log(`Sent ${path_to_file} ... ${data.length}`);
    });
}

function startTracking() {
    const path = 'mediastream/hls';

    const hlsWatcher = fs.watch(path, function (eventType, streamKey) {
        if (eventType == 'rename' && streamKey) {
            let streamDataPath = `${path}/${streamKey}`;

            if (fs.existsSync(streamDataPath)) {
                log(`----> Stream key: ${streamKey}`);
                sendData(`hls/${streamKey}`, DATA_TYPE.FOLDER_CREATE_SIG);

                streamDataWatcher = fs.watch(streamDataPath, function (event, _file) {
                    if (event == 'rename' && _file) {
                        let pathFile = `${streamDataPath}/${_file}`;

                        if (_file != 'index.m3u8.bak') {
                            if (fs.existsSync(pathFile)) {
                                if (_file == 'index.m3u8') {
                                    let m3u8Data = fs.readFileSync(pathFile);
                                    let lastIdOfComma = m3u8Data.lastIndexOf(',');
                                    let lastIdOfDot = m3u8Data.lastIndexOf('.');

                                    let fileID = parseInt(m3u8Data.slice(lastIdOfComma + 1, lastIdOfDot));
                                    sendFile(`${streamDataPath}/${fileID}.ts`, function () {
                                        let path2FileBuff = Buffer.from(`hls/${streamKey}/${_file}\r\n`);
                                        let mainfestBuff = Buffer.concat([path2FileBuff, m3u8Data], path2FileBuff.length + m3u8Data.length);
                                        sendData(mainfestBuff, DATA_TYPE.FILE);
                                    });
                                }
                            }
                        }
                    }
                });
            } else {
                log(`----> Stream key: ${streamKey} REMOVE`);
                sendData(`hls/${streamKey}`, DATA_TYPE.FOLDER_REMOVE_SIG);
            }
        }
    });

    hlsWatcher.on('error', function (err) {
        if (err) error(err);
    });
}
