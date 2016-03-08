/**
 * Created by ralemy on 11/2/15.
 * support dynamic jade templates
 */

var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    jade = require("jade"),
    router = express.Router();

function renderJade(req, res) {
    var templateFileName = path.resolve(path.dirname(__dirname),
        "views", "templates", req.params[0] + ".jade");
    fs.readFile(templateFileName, "utf8", function (err, data) {
        if (err)
            return res.status(404).send("<pre> File Not Found: " + req.params[0] + ".jade\n" + err + "</pre>");
        var templateFunction = jade.compile(data, {filename: templateFileName});
        res.status(200).send(templateFunction(req.body));
    });
}
router.get("/*", function (req, res) {
    renderJade(req, res);
});
router.post("/*", function (req, res) {
    renderJade(req, res);
});

module.exports = router;