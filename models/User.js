var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
const SALT_ROUNDS = 10;
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

    home: {
        type: Schema.Types.ObjectId, 
        ref: 'File',
    },

    streamKey: [String],

    createdAt: {
        type: Date, 
        default: Date.now()
    }
});


UserSchema.pre('save', function(next) {
    var user = this;
    if (!bcrypt.getRounds(user.password)) { // Check hashed password
        bcrypt.genSalt(SALT_ROUNDS, function(err, salt) {
            if (err) return next(err);
        
            bcrypt.hash(user.password, salt, function(err, hash) {
                if (err) return next(err);
                user.password = hash;
                next();
            });
        });
    }
});

UserSchema.methods.comparePassword = function(candiatePass, cb) {
    bcrypt.compare(candiatePass, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

module.exports = mongoose.model('User', UserSchema);

module.exports.addUser = function(user, callback) {
    user.save(callback);
};




