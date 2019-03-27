var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TokenSchema = new Schema({
    tokenStr: {
        type: String, 
        require: true
    },

    expireIn: Date, 
    lastAccess: Date,
    
    views: [Schema.Types.Mixed],

    acceptedLocation: [String],
    acceptedIp: [String],

    belongTo: {
        type: Schema.Types.ObjectId,
        require: true,
        ref: 'File'
    },

    sharedWith: [{type: String}],

    createdAt: {
        type: Date, 
        default: Date.now()
    }
}); 

module.exports = mongoose.model('Token', TokenSchema);
