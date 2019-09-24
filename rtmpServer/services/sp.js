// Trigger from rtmpServer

const fs = require('fs'),
    http = require('http');

const DATA_TYPE = {
    FOLDER_CREATE_SIG: 0,
    FILE: 1,
    FOLDER_REMOVE_SIG: 2
};

const log = console.log.bind(console),
    error = console.error.bind(console);

function sendData(data, dataType) {
    const postData = data;

    const options = {
        hostname: 'localhost',
        port: 8124,
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

    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(postData);
    req.end();
}

function sendFile(path_to_file) {
    fs.readFile(path_to_file, function (err, data) {
        let arr = path_to_file.split('/');
        let streamKey = arr[arr.length - 2];
        let filename = arr[arr.length - 1];
        let filenameBuff = Buffer.from(`hls/${streamKey}/${filename}\r\n`);

        let postData = Buffer.concat([filenameBuff, data], filenameBuff.length + data.length);
        log(`${path_to_file} ... ${data.length}`);

        sendData(postData, DATA_TYPE.FILE);
        log('Sent', filename);
    });
}


const path = 'mediastream/hls';

const hlsWatcher = fs.watch(path, function (eventType, filename) {
    if (eventType == 'rename' && filename) {
        let streamDataPath = `${path}/${filename}`;

        if (fs.existsSync(streamDataPath)) {
            log(`----> Stream key: ${filename}`);
            // sendData(`hls/${filename}`, DATA_TYPE.FOLDER_CREATE_SIG);

            let filesBuff = [];
            let maxFileId = 1;

            streamDataWatcher = fs.watch(streamDataPath, function (event, _file) {
                if (event == 'rename' && _file) {
                    let pathFile = `${streamDataPath}/${_file}`;

                    if (_file != 'index.m3u8.bak') {
                        if (fs.existsSync(pathFile)) {
                            if (_file == 'index.m3u8') {
                                // sendFile(pathFile); 
                                let data = fs.readFileSync(pathFile);
                                let lastIdOfComma = data.lastIndexOf(',');
                                let lastIdOfDot = data.lastIndexOf('.');

                                let fileID = parseInt(data.slice(lastIdOfComma + 1, lastIdOfDot));

                                if (fileID == maxFileId) {
                                    let length = fs.statSync(`${streamDataPath}/${maxFileId}.ts`).size;
                                    log(`${maxFileId}.ts`, length);
                                } else {
                                    log('Fileid', fileID, maxFileId);
                                }
                            } else {
                                maxFileId = parseInt(_file.split('.')[0]);
                                log(maxFileId);
                            }
                            // filesBuff.push(pathFile);
                            /*
                            let prev = fs.statSync(pathFile).mtimeMs;
                            let t = setInterval(function () {
                                // let file2Send = filesBuff.shift();
                                // let statfs.statSync(file2Send);
                                let curr = fs.statSync(pathFile).mtimeMs;
                                log(_file, prev, curr);
                                if (curr == prev) {
                                    let data = fs.readFileSync(pathFile);
                                    log(`${_file} ... ${data.length}`);
                                    clearInterval(t);
                                } else prev = curr;
                            }, 100);
                            */
                            //let fileId = parseInt(_file.split('.')[0]);
                            //sendFile(`${streamDataPath}/${fileId-1}.ts`);
                        }
                    }
                }
            });
        } else {
            log(`----> Stream key: ${filename} REMOVE`);
            // sendData(`hls/${filename}`, DATA_TYPE.FOLDER_REMOVE_SIG);
        }
    }
});

hlsWatcher.on('error', function (err) {
    if (err) error(err);
});