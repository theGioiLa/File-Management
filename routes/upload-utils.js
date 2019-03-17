var rimraf = require('rimraf'),
    mkdirp = require('mkdirp'),
    fileType = require('file-type'),
    fs = require('fs');

var _maxFileSize, _uploadedFilesPath, _chunkDirName; 

module.exports = {
    init: function(option) {
        if (option) {
            _maxFileSize = option.maxFileSize || 1e12;
            _uploadedFilesPath = option.uploadedFilesPath || __dirname + '/../tmp/';
            _chunkDirName = option.chunkDirName || 'chunks';
        } 
    },

    deleteTempChunkedFile:  function(owner, uuid, callback) {
        var dirToDelete = _uploadedFilesPath + owner + '/' + uuid;
        rimraf(dirToDelete, callback);
    },

    onSimpleUpload: function(fields, file, owner, res, onSaved) {
        var uuid = file.uuid = fields.qquuid,
            responseData = {
                success: false
            };

        file.name = fields.qqfilename + file.uuid;

        if (isValid(file.size)) {
            moveUploadedFile(file, uuid, owner, function() {
                    onSaved(file);
                    responseData.success = true;
                    res.send(responseData);
                },
                function() {
                    responseData.error = "Problem copying the file!";
                    res.send(responseData);
                });
        }
        else {
            failWithTooBigFile(responseData, res);
        }

    },

    onChunkedUpload: function(fields, file, owner, res, onSaved) {
        var size = file.size = parseInt(fields.qqtotalfilesize),
            uuid = file.uuid = fields.qquuid,
            index = fields.qqpartindex,
            totalParts = parseInt(fields.qqtotalparts),
            responseData = {
                success: false
            };

        file.name = fields.qqfilename + uuid;
        
        if (isValid(size)) {
            storeChunk(file, uuid, index, totalParts, owner,
                // success
                function() {
                    var destinationDir = _uploadedFilesPath + owner + '/' + uuid + "/" + _chunkDirName;
                    var partsNo = fs.readdirSync(destinationDir).length;
                    if (index < totalParts - 1 && partsNo < totalParts) {
                        responseData.success = true;
                        res.send(responseData);
                    } else {
                        if (partsNo == totalParts) {
                            combineChunks(file, uuid, owner, 
                                // success
                                function() {

                                    (async () => {
                                        const read = fs.createReadStream(_uploadedFilesPath + owner + '/' + file.name);
                                    
                                        const stream = await fileType.stream(read);
                                    
                                        file.mimetype = stream.fileType.mime;
                                        onSaved(file);
                                    })();

                                    responseData.success = true;
                                    res.send(responseData);
                                },
                                // failure
                                function() {
                                    responseData.error = "Problem conbining the chunks!";
                                    res.send(responseData);
                                }
                            );
                        } else {
                            responseData.success = true;
                            res.send(responseData);
                        }
                    }
                },

                //failure
                function(reset) {
                    responseData.error = "Problem storing the chunk!";
                    responseData.reset = reset;
                    res.send(responseData);
                }
            );
        }
        else {
            failWithTooBigFile(responseData, res);
        }
    }
};

function failWithTooBigFile(responseData, res) {
    responseData.error = "Too big!";
    responseData.preventRetry = true;
    res.send(responseData);
}

function isValid(size) {
    return _maxFileSize === 0 || size < _maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, success, failure) {
    mkdirp(destinationDir, function(error) {
        var sourceStream, destStream;

        if (error) {
            console.error("Problem creating directory " + destinationDir + ": " + error);
            failure();
        }
        else {
            sourceStream = fs.createReadStream(sourceFile);
            destStream = fs.createWriteStream(destinationFile);

            sourceStream
                .on("error", function(error) {
                    console.error("Problem copying file: " + error.stack);
                    destStream.end();
                    failure();
                })
                .on("end", function(){
                    destStream.end();
                    success();
                })
                .pipe(destStream);
        }
    });
}

function moveUploadedFile(file, uuid, owner, success, failure) {
    var destinationDir = _uploadedFilesPath + owner + '/';
    var fileDestination = destinationDir + file.name;
    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, owner, success, failure) {
    var destinationDir = _uploadedFilesPath + owner + '/' + uuid + "/" + _chunkDirName + "/",
        chunkFilename = getChunkFilename(index, numChunks),
        fileDestination = destinationDir + chunkFilename;

    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, owner, success, failure) {
    var chunksDir = _uploadedFilesPath + owner + '/' + uuid + "/" + _chunkDirName + "/",
        destinationDir = _uploadedFilesPath + owner + '/' + uuid; 
        fileDestination = _uploadedFilesPath + owner + '/' + file.name;


    fs.readdir(chunksDir, function(err, fileNames) {
        var destFileStream;

        if (err) {
            console.error("Problem listing chunks! " + err);
            failure();
        }
        else {
            fileNames.sort();
            destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

            appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
                rimraf(destinationDir, function(rimrafError) {
                    if (rimrafError) {
                        console.log("Problem deleting chunks dir! " + rimrafError);
                    }
                });
                success();
            },
            failure);
        }
    });
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
    if (index < srcFilesnames.length) {
        fs.createReadStream(srcDir + srcFilesnames[index])
            .on("end", function() {
                appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
            })
            .on("error", function(error) {
                console.error("Problem appending chunk! " + error);
                destStream.end();
                failure();
            })
            .pipe(destStream, {end: false});
    }
    else {
        destStream.end();
        success();
    }
}

function getChunkFilename(index, count) {
    var digits = new String(count).length,
        zeros = new Array(digits + 1).join("0");

    return (zeros + index).slice(-digits);
}

