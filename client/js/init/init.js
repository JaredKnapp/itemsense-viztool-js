/**
 * Created by ralemy on 11/1/15.
 * Initialize methods (run and config) for the angular app.
 */

"use strict";

module.exports = (function (app) {
    app.run(["$rootScope", "$state", "$stateParams", "$q", "CreateJS", "Stage", "Project", "$timeout", "_",
            function ($rootScope, $state, $stateParams, $q, createjs, stage, Project, $timeout, _) {
                var project = null, buffer = null, alert = null, mainTab = {}, imageVersion = 0, statusMessage = "";
                $rootScope.$state = $state;
                $rootScope.$stateParams = $stateParams;
                $rootScope.round = function (v, d) {
                    if (d === undefined) d = -2;
                    return Math.round10(v, d);
                };
                angular.promiseBitmap = function (src) {
                    var defer = $q.defer(),
                        img = new createjs.Bitmap(src);
                    img.image.onload = function () {
                        defer.resolve(img);
                    };
                    img.image.onerror = function () {
                        defer.reject(arguments);
                    };
                    return defer.promise;

                };
                angular.contrastColor = function (c) {
                    function contrast(r) {
                        var d = parseInt(r, 16);
                        d = (d > 128) ? d - 32 : d + 32;
                        return d.toString(16);
                    }

                    return "#" + contrast(c.slice(1, 3)) +
                        contrast(c.slice(3, 5)) + contrast(c.slice(5, 7));
                };
                var delayResize = null;
                window.addEventListener("resize", function (ev) {
                    if (delayResize)
                        $timeout.cancel(delayResize);
                    delayResize = $timeout(function () {
                        $rootScope.$broadcast("resize", ev);
                        delayResize = null;
                    }, 500);
                });
                window.addEventListener("keydown", function (ev) {
                    $rootScope.$broadcast("keydown", ev);
                    if (ev.srcElement.tagName === "BODY") {
                        ev.stopPropagation();
                        ev.preventDefault();
                    }
                });
                window.addEventListener("beforeunload", function (ev) {
                    const msg = "Unsaved Changes. are you sure?";
                    if (Object.keys(project.shouldSave).length) {
                        ev.returnValue = msg;
                        return msg;
                    }
                });
                function loadProject(ev, toState, toParams) {
                    ev.preventDefault();
                    return Project.get(toParams.id).then(function (prj) {
                        $rootScope.project = prj;
                        return $state.go(toState, toParams);
                    }, function () {
                        return $state.go("project", {id: "newProject"});
                    });
                }

                function shouldLoad(id) {
                    if (id)
                        if ($rootScope.project.handle !== id)
                            if (id !== "newProject")
                                return true;
                    return false;
                }

                $rootScope.$on("$stateChangeStart", function (ev, toState, toParams, fromState) {
                    if (toParams.id === "newProject" || !$rootScope.project) {
                        $rootScope.project = Project.newProject();
                    }
                    else if (shouldLoad(toParams.id.trim()))
                        return loadProject(ev, toState, toParams);

                    if (fromState.name.indexOf("floorPlan.") > -1)
                        $rootScope.$broadcast("EndPlanState", fromState.name.substr("floorPlan.".length));
                    if (toState.name.indexOf("floorPlan.") > -1)
                        $rootScope.$broadcast("StartPlanState", toState.name.substr("floorPlan.".length));
                });
                $rootScope.$on("shouldSave", function (ev, data) {
                    if (data === "readers")
                        if (project.reader.address) {
                            if (!_.find(project.changedReaders, r => r.address === project.reader.address))
                                project.changedReaders.push(project.reader);
                        }
                        else
                            project.changedReaders.push(project.reader);

                    project.shouldSave[data || "general"] = true;
                });
                $rootScope.$on("shouldNotSave", function (ev, data) {
                    if (data === "readers")  project.changedReaders = [];
                    delete project.shouldSave[data];
                });
                $rootScope.sanitize = function (s) {
                    return (s || "").trim().replace(/[^-a-zA-Z0-9._]/g, "_");
                };
                $rootScope.alertClosed = function () {
                    $rootScope.alert = null;
                };
                $rootScope.symbolUrl = function (fileName) {
                    return "/project/" + $rootScope.project.handle + "/symbols/" + ($rootScope.sanitize(fileName) || "symb");
                };
                $rootScope.hasAKey=function(obj,key){
                    return key === undefined ? _.keys(obj).length : obj[key];
                };
                Object.defineProperties($rootScope, {
                    project: {
                        enumerable: true,
                        get: function () {
                            return project;
                        },
                        set: function (v) {
                            if (project)
                                project.baseChanged();
                            project = v;
                            project.stage = stage;
                        }
                    },
                    buffer: {
                        enumerable: true,
                        get: function () {
                            return buffer;
                        },
                        set: function (v) {
                            buffer = v;
                        }
                    },
                    alert: {
                        enumerable: true,
                        get: function () {
                            return alert;
                        },
                        set: function (v) {
                            alert = v;
                        }
                    },
                    statusMessge: {
                        get: ()=>statusMessage,
                        set: v=>statusMessage = v
                    },
                    mainTab: {
                        enumerable: true,
                        get: function () {
                            return mainTab;
                        },
                        set: function (v) {
                            mainTab = v;
                        }
                    },
                    imageVersion: {
                        get: function () {
                            return imageVersion;
                        },
                        set: function (v) {
                            imageVersion = v;
                        }
                    }
                });
            }])
        .config(['flowFactoryProvider', "$stateProvider", "$urlRouterProvider",
            function (flow, $stateProvider, $urlRouterProvider) {
                $urlRouterProvider.otherwise("/project");
                $stateProvider.state("project", {
                    url: "/project/:id",
                    templateUrl: "/templates/states/project",
                    controller: "ProjectState",
                    params: {
                        id: {value: "newProject", squash: true}
                    }
                }).state("locate",{
                    url: "/locate/:id/",
                    templateUrl:"/templates/states/locate",
                    controller: "Locate"
                }).state("floorPlan", {
                    url: "/floorplan/:id/",
                    templateUrl: "/templates/states/floor_plan",
                    controller: "FloorPlan"
                }).state("floorPlan.origin", {
                    templateUrl: "/templates/states/floor_plan_origin",
                    controller: "Origin"
                }).state("floorPlan.ruler", {
                    templateUrl: "/templates/states/floor_plan_ruler"
                }).state("floorPlan.trace", {
                    templateUrl: "/templates/states/floor_plan_trace"
                }).state("floorPlan.zone", {
                    templateUrl: "/templates/states/floor_plan_zone"
                }).state("floorPlan.reader", {
                    templateUrl: "/templates/states/floor_plan_reader",
                    controller: "Readers",
                    params: {
                        x: {value: null},
                        y: {value: null}
                    }
                }).state("floorPlan.item", {
                    templateUrl: "/templates/states/floor_plan_item"
                }).state("floorPlan.area", {
                    templateUrl: "/templates/states/floor_plan_area"
                }).state("classes", {
                    url: "/classes/:id",
                    templateUrl: "/templates/states/classes",
                    controller: "Classes"
                }).state("classes.epc", {
                    url: "/:epc",
                    templateUrl: "/templates/states/classes_epc",
                    controller: "EPCEditor"
                }).state("classes.symbol", {
                    url: "/:header/:symbol",
                    templateUrl: "/templates/states/classes_symbol",
                    controller: "SymbolEditor"
                }).state("present", {
                    url: "/present/:id",
                    templateUrl: "/templates/states/present",
                    controller: "Presenter"
                });
                // Closure to make big fractions readable
                (function () {
                    /**
                     * Decimal adjustment of a number.
                     *
                     * @param {String}  type  The type of adjustment.
                     * @param {Number}  value The number.
                     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
                     * @returns {Number} The adjusted value.
                     */
                    function decimalAdjust(type, value, exp) {
                        // If the exp is undefined or zero...
                        if (typeof exp === 'undefined' || +exp === 0) {
                            return Math[type](value);
                        }
                        value = +value;
                        exp = +exp;
                        // If the value is not a number or the exp is not an integer...
                        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
                            return NaN;
                        }
                        // Shift
                        value = value.toString().split('e');
                        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
                        // Shift back
                        value = value.toString().split('e');
                        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
                    }

                    // Decimal round
                    if (!Math.round10) {
                        Math.round10 = function (value, exp) {
                            return decimalAdjust('round', value, exp);
                        };
                    }
                    // Decimal floor
                    if (!Math.floor10) {
                        Math.floor10 = function (value, exp) {
                            return decimalAdjust('floor', value, exp);
                        };
                    }
                    // Decimal ceil
                    if (!Math.ceil10) {
                        Math.ceil10 = function (value, exp) {
                            return decimalAdjust('ceil', value, exp);
                        };
                    }
                })();

                flow.defaults = {
                    target: "/upload",
                    permanentErrors: [404, 500, 501],
                    maxChunkRetries: 1,
                    chunkRetryInterval: 5000,
                    simultaneousUploads: 4,
                    singleFile: true
                };
            }]);
})(angular.module(window.mainApp));