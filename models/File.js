var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var FileSchema = new Schema({
    uuid: String,
    filename: {
        type: String,
        trim: true,
    },

    size: String,
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

module.exports.newFile = function(file, callback) {
    File.insert(file, callback);
};

module.exports.delete = function(id, callback) {
    File.findOneAndDelete({_id: id}, callback);
};
