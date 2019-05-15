const jws = require('jws'),
    config = require('../config');

module.exports = {
    authenticate,
}

function authenticate(req, res, next) {
    let accessToken = req.cookies.accessToken;
    if (accessToken) {
        if (jws.verify(accessToken, config.algorithm, config.secret)) {
            req.user = JSON.parse(jws.decode(accessToken).payload);
            next();
        } else {
            res.redirect('/user/login');
        }
    } else {
        res.redirect('/user/login');
    }

}