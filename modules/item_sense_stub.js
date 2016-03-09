/**
 * Created by ralemy on 11/19/15.
 * Item sense communication mechanism
 *
 */

var q = require("q"),
    proxy = require("./item_sense_proxy");

function handleMsg(msg) {
    var defer = q.defer();
    try {
        if (proxy[msg.command])
            defer.resolve(proxy[msg.command](msg.data));
        else
            defer.reject("command not recognized: " + msg.command);
    } catch (e) {
        defer.reject(e.toString());
    }
    return defer.promise;
}

process.on("message", function (msg) {
    handleMsg(msg.payload).then(function (response) {
        process.send({serial: msg.serial, payload: {type: "ok", data: response}});
    }, function (error) {
        console.log("catching error", error);
        var data=(error.statusCode)? error : {statusCode:500, body:"OS error "+error.name +": "+error.description};
        process.send({serial: msg.serial, payload: {type: "error", data: data}});
    });
});


module.exports = {};