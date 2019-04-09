const tus = require('tus-node-server'),
    express = require('express'),
    fs = require('fs'),
    config = require('../config'),
    multiparty = require('multiparty'),
    authen = require('../middleware/authen'),
    normalizeSize = require('../normalize').normalizeSize,
    router = express.Router();

const EVENTS = tus.EVENTS;

const server = new tus.Server();

server.datastore = new tus.FileStore({
    path: '/files'
});

router.use(authen.authenticate);
router.use(server.handle.bind(server));

server.get('/', function(req, res) {
    let user = req.user;
    let data = [];
    res.render('tus/index', {title: 'Tus Upload', username: user.username, data: data, prettySize: normalizeSize});
});

router.post('/upload', function(req, res) {
    let form = new multiparty.Form()

    form.on('part', function(part) {
        if (part.filename) {
            let ws = fs.createWriteStream(__dirname + '/../' + server.datastore.path + '/' + part.filename);
            part.pipe(ws);
        }
    });

    form.on('close', function() {
        res.status(200).send('Delete Ok');
    });

    form.parse(req);
});

server.on('EVENT_FILE_CREATED', function(event) {
    console.log('[EVENT_FILE_CREATED]', event);
});


module.exports = router;

