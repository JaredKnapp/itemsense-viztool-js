/**
 * Created by ralemy on 12/9/15.
 * Testing amqp in itemsense
 */

var request = require("request"),
    q = require("q"),
    _ = require("lodash"),
    amqp = require("amqp");


var base = "intelligentinsites.sandbox.itemsense.impinj.net";

request({
    url: "http://" + base + "/itemsense/data/v1/messageQueues/zoneTransition/configure",
    method: "POST",
    json: true,
    body: {
    }
}, function (err, response, body) {
    if (err)
        return console.log("Error registering message queue", err);
    else if (response.statusCode > 399)
        return console.log("Error registering message queue", response);

    var connection = amqp.createConnection({url: body.serverUrl, login: "SystemUser", password:"SystemUserIt3s3ns3"}, {reconnect: false});
    connection.on("ready", function () {
        console.log('ready');
        connection.queue(body.queue, {
            durable: true,
            arguments: {"x-expires": 3600000, "x-message-ttl": 3600000, "x-max-length-bytes": 1073741824}
        }, function (queue) {
            console.log("I have queue");
            queue.bind("#");
            queue.subscribe(function(message){
                console.log("message arrived",message.data.toString());
            })
        })
    });
    connection.on("error", function () {
        console.log("error", arguments);
    })

}).auth("admin", "admindefault");
