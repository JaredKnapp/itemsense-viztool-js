/**
 * Created by ralemy on 11/17/15.
 * Experimenting with fork() and process communication, parent file
 */

var fork = require("child_process").fork,
    path = require("path"),
    child = fork(path.resolve(__dirname,"process_child.js"));

child.on("message",function(){
    console.log("parent got ", arguments);
});

child.send({hello:"world"});

