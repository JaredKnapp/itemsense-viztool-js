/**
 * Created by ralemy on 11/1/15.
 * parent file for including JS libs and creating main angular module
 */
"use strict";

module.exports=(function(){

    require("./lib/angular.min.js");
    require("./lib/angular-animate.min.js");
    require("./lib/angular-sanitize.min.js");
    require("./lib/angular-ui-router.min.js");
    require("./lib/ui-bootstrap-tpls-0.14.3.min.js");
    require("./lib/angular-ui-tree.min.js");
    require("./lib/bootstrap-colorpicker-module");
    window.Flow=require("./lib/flow.min.js");
    var lodash = require("./lib/lodash.min.js"),
        buildString = "2.0.0-SNAPSHOT";
    window._ = lodash;
    window.mainApp = document.body.parentElement.getAttribute("ng-app");
    return angular.module(window.mainApp,["flow","ngSanitize","ngAnimate","ui.router","ui.bootstrap","ui.tree","colorpicker.module"])
        .factory("_",function(){
            return lodash;
        }).constant("BuildString",buildString)
        .factory("CreateJS",function(){
            return window.createjs;
        });
})();