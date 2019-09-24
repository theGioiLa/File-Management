const fs = require('fs');
const path = '../mediastream/hls';
let streamDataWatcher;

let log = console.log.bind(console);

const hlsWatcher = fs.watch(path, function (eventType, filename) {
    if (eventType == 'rename' && filename) {
        let streamDataPath = `${path}/${filename}`;

        if (fs.existsSync(streamDataPath)) {
            log(`----> Stream key: ${filename}`);
            // sendData(`hls/${filename}`, DATA_TYPE.FOLDER);

            streamDataWatcher = fs.watch(streamDataPath, function (event, _file) {
                if (event == 'rename' && _file) {
                    let pathFile = `${streamDataPath}/${_file}`;
                    if (_file != 'index.m3u8.bak') {
                        if (fs.existsSync(pathFile)) {
                            if (_file == '1.ts') {
                                log(`FILE ${streamDataPath}/0.ts ADDED`);
                                // sendFile(`${streamDataPath}/0.ts`);
                                // con
                            }

                            // sendFile(pathFile);
                            log(`FILE ${pathFile} ADDED`);
                        } else {
                            log(`FILE ${pathFile} REMOVED`);
                        }
                    }
                }
            });

        } else {
            log(`<--- Stream key: ${filename} REMOVED`);
        }
    }
});
