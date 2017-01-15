/**
 * Created by ralemy on 1/14/17.
 */

const express = require('express'),
    request = require("request"),
    q = require("q"),
    fs = require("fs-extra"),
    path = require("path"),
    _ = require("lodash"),
    router = express.Router();
const LocateBase = "http://69.178.218.200:9997"; //ToDo: Make this dynamic!!
const LocateUser = "impinjuser";
const LocatePassword = "demo2016";

function getLocateBase(){
    fs.ensureDirSync(path.resolve(__dirname, "..", "public", "locate"));
    return path.resolve(__dirname, "..", "public", "locate");
}
function getLocateImagePath(item){
    return path.resolve(getLocateBase(), item.ImageId + ".png");
}
function getLocateMetaFile(){
    return path.resolve(getLocateBase(), "metadata.json");
}
function saveJson(items){
    let defer= q.defer();
    _.each(items,item => delete item.EncodedImage);
    fs.outputJSON(getLocateMetaFile(),items,defer.makeNodeResolver());
    return defer.promise;
}
function savePicToDisk(item){
    console.log("Saving " + item.ImageId);
    let defer= q.defer();
    let buf = new Buffer(item.EncodedImage,"base64");
    fs.writeFile(getLocateImagePath(item),buf,defer.makeNodeResolver());
    return defer.promise;
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

router.get("/images/:id?", (req, res) => {
    if (!req.params.id) req.params.id = "";
    return restCall({url: LocateBase + "/impinj/images/GetImages/" + req.params.id}, LocateUser, LocatePassword)
        .then(
            data => {
                let promises = _.map(data.Items, item => savePicToDisk(item));
                return q.all(promises)
                    .then(result => saveJson(data.Items))
                    .then(result => res.json());
            })
        .catch(
            error => {
                console.log("error from locate images ", error);
                res.status(error.statusCode || 500).send(error.body || error);
            });
});

module.exports = router;
