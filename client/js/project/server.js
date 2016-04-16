/**
 * Created by ralemy on 4/16/16.
 * backend connection
 */
"use strict";
module.exports=(function(app) {
    app.factory("Server", ["_", "$http", "$q", "$rootScope", "$interval", function (_, $http, $q, $rootScope, $interval) {
        function errorDescription(response) {
            if (response.data)
                if (response.data.msg)
                    if (response.data.msg.message)
                        return response.data.msg.message;
                    else
                        return response.data.msg;
                else
                    return response.data;
            else
                return response.statusText;
        }

        function restCall(opts) {
            var options = _.merge({
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                },
                responseType: "json",
                silent: {}
            }, opts);
            return $http(options).then(function (r) {
                return r.data;
            }, function (response) {
                var description = errorDescription(response);
                if (!options.silent[response.status] && !options.silentAll)
                    $rootScope.alert = {
                        type: "warning",
                        msg: "Server error " + response.status + " " + description
                    };
                return $q.reject(response);
            });
        }

        return {
            get: function (id) {
                return restCall({
                    url: "/project/" + id
                });
            },
            save: function () {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/",
                    data: self
                }).then(function (data) {
                    if (self.zoneMap)
                        return self.addZoneMap(self.zoneMap).then(function () {
                            return data;
                        });
                    return data;
                });
            },
            connect: function () {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/" + self.handle + "/connect",
                    data: self
                }).then(function (data) {
                    self.recipes = data.recipes || [];
                    self.job = data.job;
                    self.facilities = _.map(data.facilities, f=>f.name);
                    self.zoneMaps = data.zoneMaps || [];
                    self.zoneMap = _.find(data.zoneMaps, function (z) {
                        return z.name === data.currentZoneMap.name;
                    });
                    self.recipe = data.job ? _.find(self.recipes, function (r) {
                        return r.name === data.job.job.recipeName;
                    }) : null;
                    self.duration = data.job ? data.job.job.durationSeconds : 20;
                    if (self.job) {
                        self.jobMonitor = self.jobMonitor;
                        self.pullItems = self.pullItems;
                    }
                    if (self.showReaders && !self.readers)
                        return self.getReaders();
                    return self;
                });
            },
            getReaders: function () {
                return restCall({
                    url: `/project/${this.handle}/readers`
                }).then((readers) => {
                    this.readers = readers;
                    if (this.stage)
                        this.stage.showReaders(this.showReaders);
                    return this;
                });
            },
            postReaders: function (reader) {
                var self = this;
                return restCall({
                    url: `/project/${this.handle}/readers`,
                    method: "POST",
                    data: reader
                }).then(function () {
                    self.showReaders = false;
                    return self.getReaders().then(function () {
                        self.showReaders = true;
                    });
                });
            },
            getRecipes: function () {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/" + self.handle + "/recipes",
                    data: self
                }).then(function (recipes) {
                    self.recipes = recipes;
                    return self;
                });
            },
            startJob: function () {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/" + self.handle + "/job",
                    data: {
                        recipeName: self.recipe.name,
                        durationSeconds: self.duration,
                        facility: self.facility
                    },
                    silent: {400: true}
                }).then(function (job) {
                    self.job = job;
                    self.jobMonitor = true;
                    return self;
                }, function (response) {
                    if (response.status === 400)
                        $rootScope.alert = {
                            type: "warning",
                            msg: response.data.msg.message
                        };
                    return $q.reject(response);
                });
            },
            checkJob: function () {
                var self = this;
                if (self.job)
                    restCall({
                        url: "/project/" + self.handle + "/job/" + self.job.id,
                        silent: {all: true}
                    }).then(function (job) {
                        self.job = job;
                        if (!self.isJobRunning())
                            self.jobInterval = null;
                    });
                else
                    self.jobInterval = null;
            },
            monitorJob: function () {
                var self = this;
                this.checkJob();
                return (this.job) ?
                    $interval(function () {
                        self.checkJob();
                    }, 1000) : null;
            },
            stopJob: function () {
                var self = this;
                return restCall({
                    method: "DELETE",
                    url: "/project/" + self.handle + "/job/" + self.job.id
                });
            },
            getItems: function (opts) {
                var self = this;
                return restCall(_.merge({
                    url: "/project/" + self.handle + "/items"
                }, opts)).then(function (items) {
                    self.items = items;
                    self.showItems = self.showItems;
                    if (!self.isJobRunning())
                        self.pullItems = false;
                    return items;
                });
            },
            addZoneMap: function (data) {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/" + self.handle + "/zones",
                    data: data
                }).then(function (zoneMap) {
                    self.zoneMap = zoneMap;
                    self.zones = zoneMap.zones;
                });
            },
            deleteZoneMap: function(zoneMap){
                return restCall({
                    method:"Delete",
                    url:`/project/${this.handle}/zones/${zoneMap.name}`
                }).then(()=>{
                    this.zoneMaps = _.filter(this.zoneMaps, z => z !== zoneMap);
                });
            },
            setCurrentZoneMap: function (name) {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/" + self.handle + "/zones/" + name
                });
            },
            getLLRPStatus(){
                return restCall({
                    url: `/project/${this.handle}/llrp`
                });
            },
            getFacilities(){
                return restCall({
                    method: "POST",
                    data: {
                        url: this.itemSense,
                        user: this.user,
                        password: this.password
                    },
                    url: `/project/${this.handle}/facilities`
                }).then(facilities => this.facilities = _.map(facilities, f=> f.name));
            }
        };
    }]);
})(angular.module(window.mainApp));
