/**
 * Created by ralemy on 11/17/15.
 * Child process in fork() experiment
 */

process.on("message",function(m){
    console.log("child got",arguments);
});

process.send({foo:"bar"});



