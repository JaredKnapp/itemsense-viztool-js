/**
 * Created by ralemy on 11/1/15.
 * collection of controllers used for the app
 */

"use strict";

module.exports = (function (app) {

    app.controller("topLevel", ["$scope", "Requester", "$http", "_", function ($scope, Requester, $http, _) {
            $scope.about = function () {
                Requester.about();
            };
            $scope.select = function () {
                $http({
                    url: "/project",
                    method: "GET"
                }).then(function (response) {
                    return Requester.selectProject(response.data);
                }).then(function (prj) {
                    $scope.$state.go("project", {id: prj.handle}, {reload: true});
                });
            };
            $scope.setEpcFilter = function () {
                if (!$scope.project)
                    return;
                var newFilter = window.prompt("Filter EPC by regular expression", $scope.project.epcFilter);
                if (newFilter === null)
                    return;
                $scope.project.epcFilter = newFilter;
            };
            $scope.setFloorName = function () {
                if (!$scope.project)
                    return;
                var floorName = window.prompt("Set Floor Name for the project", $scope.project.floorName || "");
                if (floorName !== null)
                    $scope.project.floorName = floorName;
            };
            $scope.canStart = function () {
                if (!$scope.project)
                    return false;

                var recipe = $scope.project.recipe ? _.find($scope.project.recipes, function (r) {
                    return r.name === $scope.project.recipe.name;
                }) : null;
                return recipe && ($scope.project.duration > 20);
            };
            $scope.targetClasses = function () {
                return "/project/" + $scope.project.handle + "/csv/classes";
            };
            $scope.targetSymbols = function () {
                return "/project/" + $scope.project.handle + "/csv/symbols";
            };
            $scope.uploadSuccess = function (file, message, flow, target) {
                $scope.project.addTarget(target, JSON.parse(message));
            };
        }])
        .factory("Requester", ["$uibModal", "_", function ($uibModal, _) {
            function openModal(options) {
                var opts = _.extend({animation: true, size: "lg", params: {}}, options);
                var instance = $uibModal.open({
                    animation: opts.animation,
                    templateUrl: opts.templateUrl,
                    controller: opts.controller,
                    size: opts.size,
                    resolve: {
                        params: function () {
                            return opts.params;
                        }
                    }
                });
                instance.result.modalInstance = instance;
                return instance.result;
            }

            return {
                about: function () {
                    return openModal({
                        templateUrl: "/templates/requesters/about",
                        controller: "AboutApp"
                    });
                },
                selectProject: function (projects) {
                    return openModal({
                        templateUrl: "/templates/requesters/select_project",
                        controller: "SelectProject",
                        params: {
                            projects: projects
                        }
                    });
                }
            };
        }])
        .controller("AboutApp", ["$scope", "$uibModalInstance", "params", "BuildString",
            function ($scope, $modal, params, buildString) {
                $scope.buildString = buildString;
                $scope.ok = function () {
                    $modal.close();
                };
            }])
        .controller("SelectProject", ["$scope", "$uibModalInstance", "params",
            function ($scope, $modal, params) {
                $scope.projects = params.projects;
                $scope.selectProject = function (project) {
                    $modal.close(project);
                };
                $scope.cancel = function () {
                    $modal.dismiss("close");
                };
            }])
        .controller("ProjectState", ["$scope", function ($scope) {
            $scope.mainTab = {project: true};

            $scope.projectInfo = function () {
                if (!$scope.project.job)
                    return "";
                var job = $scope.project.job,
                    start = new Date(job.creationTime.substr(0, 24)),
                    last = new Date(job.lastActivityTime.substr(0, 24)),
                    duration = job.activeDuration.substr(2),
                    activity = Math.round10((last.getTime() - start.getTime()) / 1000, -2);
                duration = duration.substr(0, duration.length - 1);
                if (job.status === "COMPLETE")
                    return "Last job completed at " + last.toLocaleString() + " for " + duration + " seconds";
                else if (job.status === "STOPPED")
                    return "Last job cancelled at " + last.toLocaleString() + " after " + activity + " seconds";
                return "Started " + start.toLocaleString() + " scheduled for " + job.job.durationSeconds + " seconds";
            };
        }])
        .controller("FloorPlan", ["$scope", function ($scope) {
            var imageVersion = 0;
            $scope.mainTab = {floorPlan: true};
            $scope.fields = [{i: 0, n: 'Hide'}, {i: 1, n: '3 Meters'}, {i: 2, n: '4 Meters'}, {i: 3, n: '5 Meters'}];
            $scope.targetUrl = function () {
                if ($scope.project)
                    return "/project/" + $scope.project.handle + "/upload/1";
            };
            $scope.uploadSuccess = function (flow, message) {
                message = JSON.parse(message);
                $scope.project.floorPlan = message.filename;
                imageVersion += 1;
                return $scope.project.save($scope.project);
            };
            $scope.imageSrc = function () {
                //this doesn't hold previous version of the image, it just forces the ng-src to reload the new image
                if ($scope.project)
                    return "/projects/" + $scope.project.handle + "/" + $scope.project.floorPlan + "?v=" + imageVersion;
            };
            $scope.zoomIn = function () {
                $scope.project.zoom += 0.1;
            };
            $scope.zoomOut = function () {
                var zoom = $scope.project.zoom - 0.1;
                if (zoom < 0.08)
                    zoom = 0.1;
                $scope.project.zoom = zoom;
            };
            $scope.zoomReset = function () {
                $scope.project.zoom = 1.0;
            };
            $scope.zoomWidth = function () {
                $scope.project.zoomWidth();
            };
            $scope.moveOrigin = function () {
                $scope.$state.go("floorPlan.origin");
            };
            $scope.moveRuler = function () {
                if ($scope.$state.is("floorPlan.ruler"))
                    $scope.$state.go("floorPlan");
                else
                    $scope.$state.go("floorPlan.ruler");
            };
            $scope.trace = function () {
                if ($scope.$state.is("floorPlan.trace"))
                    $scope.$state.go("floorPlan");
                else
                    $scope.$state.go("floorPlan.trace");
            };
            $scope.setScale = function () {
                var v = window.prompt("Enter the measured length of ruler in meters", $scope.project._rulerMeters);
                if (v)
                    $scope.project.setScale(v);
            };
            $scope.addReader = function(point){
                $scope.$state.go("floorPlan.reader",{
                    x: $scope.project.stageToMeters($scope.project.rulerCoords[point+ 'X'],'x'),
                    y: $scope.project.stageToMeters($scope.project.rulerCoords[point+ 'Y'],'y')
                });
            };
        }])
        .controller("Readers", ["$scope", function ($scope) {
            var stageReader;
            function makeReader() {
                var newReader = {
                    address: "",
                    name: "",
                    facility: "DEFAULT",
                    type: "XARRAY",
                    readerZone: "",
                    antennaZones: null,
                    labels: null,
                    placement: {
                        x: $scope.$stateParams.x || 0,
                        y: $scope.$stateParams.y || 0,
                        z: 0,
                        yaw: 0, pitch: 0, roll: 0,
                        floor: $scope.project.floorName || ""
                    }
                };
                $scope.project.readers.push(newReader);
                stageReader = $scope.project.stage ? $scope.project.stage.addReader(newReader) : null;
                return newReader;
            }

            $scope.activeReader = $scope.project.reader || makeReader();

            $scope.$watch(function(){
                return $scope.project.reader;
            },function(n){
                if(n && n !== $scope.activeReader)
                    $scope.activeReader = n;
            });
            $scope.newReader = function () {
                if ($scope.project.stage)
                    $scope.project.stage.reader = null;
                else
                    $scope.project.reader = null;
                $scope.activeReader = makeReader();
            };

            $scope.cancel = function () {
                $scope.project.showReaders=false;
                $scope.project.getReaders().then(function(){
                    $scope.project.showReaders=true;
                    $scope.$state.go("floorPlan");
                });
            };

            $scope.save=function(){
                $scope.project.postReaders($scope.activeReader).then(function(){
                    $scope.$state.go("floorPlan");
                });
            };

        }])
        .controller("Classes", ["$scope", "_", function ($scope, _) {
            $scope.mainTab = {classes: true};
            var classes;
            Object.defineProperty($scope, "classes", {
                get: function () {
                    return classes;
                },
                set: function (v) {
                    classes = v;
                }
            });
            $scope.sortStatus = {};
            $scope.headers = _.map($scope.project.classes, function (v, k) {
                return k;
            });
            classes = _.map($scope.project.itemHash, function (v) {
                return v;
            });
            $scope.sortClassesBy = function (key) {
                var sort = !$scope.sortStatus[key];
                $scope.sortStatus = {};
                $scope.sortStatus[key] = sort;
                $scope.classes = _.sortByOrder($scope.classes, [key], sort);
            };
            $scope.editRecord = function (record) {
                $scope.$state.go("classes.epc", {epc: record.EPC});
            };
            $scope.editSymbol = function (symbol, header) {
                $scope.$state.go("classes.symbol", {symbol: symbol, header: header});
            };
            $scope.sortClassesBy("EPC");
        }])
        .controller("EPCEditor", ["$scope", "_", function ($scope, _) {
            $scope.record = $scope.project.itemHash [$scope.$stateParams.epc];
            $scope.$on("keydown", function () {
                console.log("keydown", arguments);
            });
            $scope.cloneTag = function () {
                var newEpc = (window.prompt("Enter Epc for the copied tag", $scope.record.EPC) || "")
                    .trim().toUpperCase();
                if (!newEpc)
                    return;
                if ($scope.project.itemHash[newEpc])
                    return window.alert("EPC " + newEpc + " already Exists");
                var idx = _.findIndex($scope.classes, $scope.record);
                $scope.record = _.merge({}, $scope.record, {EPC: newEpc});
                delete $scope.record.$$hashKey;
                $scope.project.itemHash[newEpc] = $scope.record;
                $scope.classes.splice(idx, 0, $scope.record);
            };
            $scope.deleteTag = function (epc) {
                if (!window.confirm("Are you sure to delete this tag?"))
                    return;
                delete $scope.project.itemHash[$scope.record.EPC];
                $scope.classes = _.filter($scope.classes, function (c) {
                    return c.EPC !== epc;
                });
                $scope.$state.go("classes");
            };
            $scope.editEpc = function () {
                var newEpc = (window.prompt("Enter new Epc for the tag", $scope.record.EPC) || "")
                    .trim().toUpperCase();
                if (!newEpc || newEpc === $scope.record.EPC)
                    return;
                if ($scope.project.itemHash[newEpc])
                    return window.alert("EPC " + newEpc + " already Exists");
                delete $scope.project.itemHash[$scope.record.EPC];
                $scope.record.EPC = newEpc;
                $scope.project.itemHash[newEpc] = $scope.record;
            };
        }])
        .controller("SymbolEditor", ["$scope", "_", function ($scope, _) {
            var imageVersion = 0;
            if (!$scope.project.symbols[$scope.$stateParams.symbol.toLowerCase()])
                $scope.project.symbols[$scope.$stateParams.symbol.toLowerCase()] = {Property: $scope.$stateParams.symbol};
            $scope.symbol = $scope.project.symbols[$scope.$stateParams.symbol.toLowerCase()];
            if (!$scope.symbol.Color)
                $scope.symbol.Color = "";
            $scope.getBorder = function (c) {
                return angular.contrastColor(c);
            };
            $scope.bkColor = function (symbol) {
                return symbol.Color || "";
            };
            $scope.targetSymbol = function () {
                return "/project/" + $scope.project.handle + "/symbols/" + ($scope.sanitize($scope.symbol.Property) || "symb");
            };
            $scope.uploadSuccess = function (flow, message) {
                var m = JSON.parse(message);
                imageVersion += 1;
                $scope.symbol.Image = m.filename;
            };
            $scope.symbolImage = function () {
                return "/projects/" + $scope.project.handle + "/symbols/" + $scope.sanitize($scope.symbol.Image) + "?v=" + imageVersion;
            };
            $scope.deleteSymbol = function () {
                var header = $scope.$stateParams.header,
                    symbol = $scope.$stateParams.symbol,
                    newSymbol = (window.prompt("Enter the replacement Label") || "").trim();
                if (!newSymbol)
                    return;
                if (!$scope.project.symbols[newSymbol.toLowerCase()])
                    return window.alert("Symbol " + newSymbol + " does not exist");
                _.each($scope.classes, function (c) {
                    if (c[header] === symbol)
                        c[header] = newSymbol;
                });
                $scope.project.classes[header] = _.filter($scope.project.classes[header], function (item) {
                    return item !== symbol;
                });
                delete $scope.project.symbols[symbol.toLowerCase()];
                $scope.$state.go("classes");
            };
            $scope.cloneSymbol = function () {
                var header = $scope.$stateParams.header,
                    newSymbol = (window.prompt("Enter label for new Symbol") || "").trim();
                if (!newSymbol)
                    return;
                if ($scope.project.symbols[newSymbol.toLowerCase()])
                    return window.alert("Label " + newSymbol + " already exits");
                $scope.project.symbols[newSymbol.toLowerCase()] = _.merge({}, $scope.symbol, {Property: newSymbol});
                $scope.project.classes[header].push(newSymbol);
            };
            $scope.editLabel = function () {
                var header = $scope.$stateParams.header,
                    newLabel = (window.prompt("Enter new Label for the Symbol", $scope.symbol.Property) || "")
                        .trim();
                if (!newLabel || newLabel === $scope.symbol.Property)
                    return;
                if ($scope.project.symbols[newLabel.toLowerCase()])
                    return window.alert("Label " + newLabel + " already Exists");
                _.each($scope.classes, function (c) {
                    if (c[header] === $scope.symbol.Property)
                        c[header] = newLabel;
                });
                $scope.project.classes[header] = _.map($scope.project.classes[header], function (i) {
                    return (i === $scope.symbol.Property) ? newLabel : i;
                });
                delete $scope.project.symbols[$scope.symbol.Property.toLowerCase()];
                $scope.symbol.Property = newLabel;
                $scope.project.symbols[newLabel.toLowerCase()] = $scope.symbol;
            };
        }])
        .controller("Presenter", ["$scope", "_", "PresentationCandidates", function ($scope, _, CandidateFilter) {
            var classes = Object.keys($scope.project.classes),
                selectedClass = classes[0],
                selection = $scope.project.selection,
                findCandidates = CandidateFilter($scope.project, selection),
                candidates = findCandidates();

            Object.defineProperties($scope, {
                selectedClass: {
                    get: function () {
                        return selectedClass;
                    },
                    set: function (v) {
                        selectedClass = v;
                    }
                },
                classes: {
                    get: function () {
                        return classes;
                    },
                    set: function (v) {
                        classes = v;
                    }
                },
                selection: {
                    get: function () {
                        return selection;
                    },
                    set: function (v) {
                        _.each(selection, function (c, k) {
                            delete selection[k];
                            if (v[k])
                                selection[k] = v[k];
                        });
                    }
                },
                candidates: {
                    get: function () {
                        return candidates;
                    },
                    set: function (v) {
                        candidates = v;
                        $scope.project.updateSelection();
                    }
                }
            });

            $scope.getSelectorClass = function () {
                return "col-md-" + Math.floor(12 / ($scope.classes.length || 1));
            };

            $scope.getSelectorIcon = function (c) {
                if (!$scope.selection[c])
                    return c;
                return $scope.selection[c].Image ? "<img src='" + $scope.project.symbolImage($scope.selection[c].Image) + "'>" :
                    $scope.selection[c].Property;
            };
            $scope.filterItems = function (c, i) {
                $scope.selection[c] = $scope.project.symbols[i.toLowerCase()] || {Property: i, Color: ""};
                $scope.candidates = findCandidates();
            };
            $scope.setColor = function (s) {
                if (s)
                    if (s.Color)
                        return "background-color:" + s.Color + "; border-color:" + angular.contrastColor(s.Color) + ";";
                return "";
            };
            $scope.clearSelection = function (v) {
                if (v)
                    delete $scope.selection[v];
                else
                    $scope.selection = {};
                $scope.selectedClass = v || $scope.classes[0];
                $scope.candidates = findCandidates();
            };
            $scope.$on("Presenter", function (ev, message) {
                $scope.iconTitle = message;
            });
            $scope.getIconColor = function () {
                if ($scope.iconTitle)
                    return ($scope.iconTitle === "running") ? "greenMarker" : "redMarker";
            };
        }]);
})(angular.module(window.mainApp));
