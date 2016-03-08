/**
 * Created by ralemy on 12/9/15.
 * Testing amqp in itemsense
 */

var request = require("request"),
    q = require("q"),
    _ = require("lodash"),
    amqp = require("amqp");

/* this Fails
var base="http://intelligentinsites.sandbox.itemsense.impinj.net",
    login = "admin",
    password = "admindefault";
*/

/* This works
var base="http://intelligentinsites.sandbox.itemsense.impinj.net",
	login="SystemUser",
	password="SystemUserIt3s3ns3";
*/


var epcFilter = "E1202$";
// epcFilter="C0DEF100D201512090000004";

configureZoneTransition(base).then(function (sequenceStore) {

    console.log("got Zone info, connecting...");
    return connectToSequenceStore(sequenceStore);

}).then(function (sequenceStore) {

    console.log("connected, initializing queue ....");
    return waitForMessages(sequenceStore);

}).progress(function (message) {

    if (message.epc.match(epcFilter))
        console.log("\nmessage arrived --->", message);
    process.stdout.write(".");

}).catch(function (err) {

    console.log("Error happened", err);

});

function configureZoneTransition(baseUrl) {
    var defer = q.defer();
    request({
        url: baseUrl + "/itemsense/data/v1/messageQueues/zoneTransition/configure",
        method: "POST",
        json: true,
        body: {}
    }, function (err, response, body) {
        if (err)
            defer.reject(err);
        else if (response.statusCode > 399)
            defer.reject(response);
        else
            defer.resolve(body);
    }).auth("admin", "admindefault");
    return defer.promise;
}

function connectToSequenceStore(sequenceStore) {

    sequenceStore.connection = amqp.createConnection({
        url: sequenceStore.serverUrl,
        login: login,
        password: password
    }, {reconnect: false});

    return sequenceStore;
}

function waitForMessages(sequenceStore) {
    var defer = q.defer();
    sequenceStore.connection.on("ready", function () {
        console.log("Connection ready, starting queue listener");
        sequenceStore.connection.queue(sequenceStore.queue, {
            durable: true,
            arguments: {"x-expires": 3600000, "x-message-ttl": 3600000, "x-max-length-bytes": 1073741824}
        }, function (queue) {
            console.log("queue ready, listening for messages");
            queue.bind("#");
            queue.subscribe(function (message) {
                defer.notify(JSON.parse(message.data))
            })
        });
    });
    sequenceStore.connection.on("error", function (err) {
        defer.reject(err);
    });
    sequenceStore.disconnect = function () {
        sequenceStore.connection.disconnect();
        defer.resolve();
    };
    return defer.promise;
}
