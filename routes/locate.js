/**
 * Created by ralemy on 1/14/17.
 */

const express = require('express'),
    request = require("request"),
    q = require("q"),
    fs = require("fs-extra"),
    path = require("path"),
    _ = require("lodash"),
    util = require("../modules/util"),
    router = express.Router();

const LocateBase = "http://69.178.218.200:9997"; //ToDo: Make this dynamic!!
const LocateUser = "impinjuser";
const LocatePassword = "demo2016";

function savePicToProject(projectId, item) {
    let projectDir = util.getProjectDir(projectId);
    let defer = q.defer();
    fs.ensureDirSync(projectDir);
    fs.writeFile(
        path.resolve(projectDir, "floorplan-" + item.ImageId + ".png"), //ToDo: specify the type of picture in the object
        new Buffer(item.EncodedImage, "base64"),
        defer.makeNodeResolver()
    );
    return defer.promise.then(result => {
        delete item.EncodedImage;
        return item;
    });
}

function restCall(opts, user, password) {
    const defer = q.defer(),
        options = _.extend({method: "GET", json: true}, opts),
        req = request(options, function (err, response, body) {
            if (err)
                defer.reject(err);
            else if (response.statusCode > 399)
                defer.reject(response);
            else
                defer.resolve(body);
        });
    if (user)
        req.auth(user, password);
    return defer.promise;
}

router.get("/areas/:id?", (req, res) => {
    if (!req.params.id) req.params.id = "";
    return restCall({url: LocateBase + "/impinj/areas/GetAreas/" + req.params.id}, LocateUser, LocatePassword)
        .then(data => {
                res.json(data);
            },
            error => {
                if (!error) error = "Unknown Error";
                console.log("error calling locate", error);
                res.status(error.statusCode || 500).send(error.body || error);
            }
        );
});


router.get("/image/:id/:pId", (req, res) => {
    return restCall({url: LocateBase + "/impinj/images/GetImages/" + req.params.id}, LocateUser, LocatePassword)
        .then(
            data => {
                return savePicToProject(req.params.pId, data)
                    .then(result => res.json(result));
            }
        ).catch(
            error => {
                console.log("error importing locate background", error);
                res.status(error.statusCode || 500).send(error.body || error);
            }
        )
});

module.exports = router;
