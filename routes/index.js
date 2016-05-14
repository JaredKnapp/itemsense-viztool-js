const express = require('express'),
    npmPackage = require("../package.json"),
    router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', {title: 'Impinj', angularApp: "VizTool", appVersion: npmPackage.version});
});

module.exports = router;
