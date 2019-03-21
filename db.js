var mogoose = require('mongoose');
const url = 'mongodb://localhost/FileUploadingSys';
var db = mogoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to database ' + db.name + ' at ' + db.host);
});

module.exports.connect = () => {mogoose.connect(url, { useCreateIndex: true, useNewUrlParser: true });};