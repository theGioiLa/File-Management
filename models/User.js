var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var Joi = require('joi');
const SALT_WORK_FACTOR = 10;
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    username: {
        type: String,
        require: true,
        minlength: 5,
        maxlength: 50
    },

    password: {
        type: String,
        require: true
    },

    files: [{type: Schema.Types.ObjectId, ref: 'File'}],

    createdAt: {
        type: Date, 
        default: Date.now()
    }
});


UserSchema.pre('save', function(next) {
    var user = this;
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);
    
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
    
            user.password = hash;
            next();
        });
    });
});

UserSchema.methods.comparePassword = function(candiatePass, cb) {
    bcrypt.compare(candiatePass, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    })
};

function validateUser(user) {
    const template = {
        username: Joi.string().min(5).max(50).required(),
        password: Joi.string().min.require()
    };

    return Joi.validate(user, template);
}


var User = module.exports = mongoose.model('User', UserSchema);
module.exports.validate = validateUser;
module.exports.getUserByName = function(name, callback) {
   User.findOne({username: name}, callback);
};

module.exports.addUser = function(user, callback) {
    user.save(callback);
};

module.exports.get_all_files = function(userId, callback) {
    User.findById(userId).populate('fileskk')
    User.findById(userId, callback);
};  



