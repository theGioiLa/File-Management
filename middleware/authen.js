module.exports = {
    authenticate,
}

function authenticate(req, res, next) {
    if (req.session.isLogined) next();
    else res.redirect('/user/login');
}