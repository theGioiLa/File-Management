const chokidar = require('chokidar');
const fs = require('fs');

let path = '../mediastream/hls';

let watcher = chokidar.watch(path);

watcher.on('addDir', function(_path) {
    if (_path != path) {
        console.log(`DIR ${_path} has been ADDED`);
    }
});

/*
watcher.on('change', function(_path) {
    console.log(`${_path} CHANGED`);
});
*/

watcher.on('unlinkDir', function(_path) {
    console.log(`DIR ${_path} has been REMOVED`);
});

watcher.on('add', function(_path) {
    console.log(`FILE ${_path} has been ADDED`);
    fs.readFile(_path, function(err, data) {
        console.log(`${_path} ... ${data.length}`);
    });
});

watcher.on('unlink', function(_path) {
    console.log(`FILE ${_path} has been REMOVED`);
});

