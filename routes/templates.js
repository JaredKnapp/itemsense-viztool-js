/**
 * Created by ralemy on 11/2/15.
 * support dynamic jade templates
 */

var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    jade = require("jade"),
    q = require("q"),
    router = express.Router();

function promiseReadFile(filename, encoding){
    let defer = q.defer();
    if(!encoding) encoding = "utf8";
    fs.readFile(filename,encoding,defer.makeNodeResolver());
    return defer.promise;
}

function renderJade(req, res) {
    let templateFileName = path.resolve(path.dirname(__dirname),
        "views", "templates", req.params[0] );
    return promiseReadFile(templateFileName + ".jade")
        .catch(error => promiseReadFile(templateFileName + ".pug"))
        .then(data => {
            res.status(200).send(jade.compile(data,{filename: templateFileName})(req.body));
        })
        .catch(error => {
            console.log("Jade error", error);
            res.status(500).send(error);
        });
}
router.get("/*", function (req, res) {
    renderJade(req, res);
});
router.post("/*", function (req, res) {
    renderJade(req, res);
});

module.exports = router;