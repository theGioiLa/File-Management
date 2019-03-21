var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TokenSchema = new Schema({
    token: {
        type: String, 
        require: true
    },

    owner: {
        type: Schema.Types.ObjectId,
        require: true,
        ref: 'File'
    },

    createdAt: {
        type: Date, 
        default: Date.now()
    }
}); 

module.exports = mongoose.model('Token', TokenSchema);
