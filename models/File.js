var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var FileSchema = new Schema({
    filename: {
        type: String,
        trim: true,
    },

    size: Number,
    mimetype: String,

    filepath: {
        type: String,
        require: true,
        trim: true
    },

    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },

    createdAt: {
        type: Date, 
        default: Date.now()
    }
}); 


var File = module.exports = mongoose.model('File', FileSchema);
module.exports.newFolder = function(folder, callback) {
    folder.save(callback);
};

module.exports.newFile = function(files, callback) {
    File.insertMany(files, callback);
};

module.exports.delete = function(filename, callback) {
    File.findOneAndDelete({filename: filename}, callback);
    File.findOneAndDelete({filepath: filepath}, callback);
}
