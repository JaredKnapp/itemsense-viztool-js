/**
 * Created by ralemy on 11/17/15.
 * This module spawns a task to connect to item sense and communicates with it
 */

var fork = require("child_process").fork,
    path = require("path"),
    q = require("q"),
    _ = require("lodash"),
    processes = {},
    promises = {},
    serial = 0,
    cleanExit = function() { process.exit() };

process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill

process.on("exit",function(){
    _.each(processes,function(p){
        if (p.child)
            p.child.kill();
    });
});

function promise() {
    serial += 1;
    promises[serial] = {
        serial: serial,
        defer: q.defer()
    };
    return promises[serial];
}

function handleIncomingMessage(msg) {
    if (!msg.serial || !msg.payload)
        return console.log("Msg without serial number or payload is ignored", msg);
    else if (!promises[msg.serial])
        console.log("Msg serial not found", msg);
    else if (msg.payload.type === "error")
        promises[msg.serial].defer.reject(msg);
    else
        promises[msg.serial].defer.resolve(msg);
    promises[msg.serial] = null;
}

function wrapChild(child) {
    child.on("message", handleIncomingMessage);

    return Object.create({
        invoke: function (msg) {
            var p = promise();
            child.send({serial: p.serial, payload: msg});
            return p.defer.promise;
        },
        kill:function(){
            if(this.child)
                this.child.kill();
        }
    }, {
        child: {
            enumerable: true,
            get: function () {
                return child;
            }
        }
    })
}

function createStub(project) {
    var defer = q.defer(),
        child = fork(path.resolve(__dirname, "item_sense_stub.js"));
    child.once("message", function (msg) {
        if (msg.payload.type === "error")
            defer.reject(msg);
        else
            defer.resolve(wrapChild(child));
    });
    child.on("error", function (error) {
        defer.reject(error);
        processes[project.handle] = null;
    });
    child.send({serial: 0, payload: {command: "init", data: project}});
    return defer.promise;
}

var md = {
    startProcess: function (project) {
        if (!processes[project.handle])
            processes[project.handle] = createStub(project).catch(function(err){
                processes[project.handle]=null;
                console.log("couldn't create stub");
                return q.reject(err);
            });
        return processes[project.handle].then(function(child){
            return md.invoke(project.handle, {command:"connect"});
        });
    },
    updateProcess: function(project){
        if(!processes[project.handle])
            return this.startProcess(project);
        else
            return this.stopProcess(project.handle).then(function(){
                return md.startProcess(project);
            });
    },
    stopProcess:function(id){
        if(!processes[id])
            return q.reject({payload:{data:{statusCode:404,body:"Not Found: "+id}}});
        return processes[id].then(function(child){
            child.kill();
            processes[id]=null;
        });
    },
    invoke: function (id, payload) {
        if (!processes[id])
            return q.reject("Project not started: " + id);
        return processes[id].then(function (child) {
            return child.invoke(payload);
        });
    }
};


module.exports = md;
