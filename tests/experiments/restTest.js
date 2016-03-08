/**
 * Created by ralemy on 1/18/16.
 * Testing Restful calls to Item Sense
 */

var request = require("request");

//This fails! with authError: no auth token. 401
var base = "http://127.0.0.1:8010",
    login = "admin",
    pass = "impinjsvl";

/*
// this works!!
var base = "http://rec.itemsense.impinj.com",
    login ="admin",
    pass = "admindefault";
*/

request({
    url:base+"/itemsense/authentication/v1/token",
    json:true,
    method:"GET"
},function(){
    console.log(arguments);
}).auth(login,pass);
