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
                    url: "/project/" + (id || "")
                });
            },
            saveChangedReaders(){
                var self= this;
                if(_.find(self.changedReaders, r => !r.address.trim()))
                    if(!window.confirm("Readers with No addresses will not be saved. Continue?"))
                        return $q.reject("Readers with no addresses");
                return $q.all(_.map(self.getChangedReaders(),r=> self.postReaders(r)))
                    .then(()=>self.getReaders())
                    .then(()=> self.showReaders = !!self.showReaders);
            },
            save: function () {
                var self = this;
                return restCall({
                    method: "POST",
                    url: "/project/",
                    data: self
                }).then(() => {
                    delete self.shouldSave.general;
                    if(self.shouldSave.zones)
                        return self.saveZoneMap(self.zoneMap);
                }).then(()=>{
                    delete self.shouldSave.zones;
                    if(self.shouldSave.readers)
                        return self.saveChangedReaders();
                }).then(()=>{
                    delete self.shouldSave.readers;
                    self.changedReaders = [];
                });
            },
            deleteProject(data){
                return restCall({
                    method:"DELETE",
                    url: `/project/${data.handle}`
                }).then(()=>restCall({url:"/project"}));
            },
            connect: function () {
                var self = this;
                $rootScope.statusMessage = "Connecting to Itemsense Instance ....";
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
                    self.recipe = _.find(self.recipes, (r) =>{
                        if(data.job)
                            return r.name === data.job.job.recipeName;
                        if(self.recipe)
                            return r.name === self.recipe.name;
                    });
                    self.duration = data.job ? data.job.job.durationSeconds : 20;
                    if (self.job) {
                        self.jobMonitor = !!self.jobMonitor;
                        self.pullItems = !!self.pullItems;
                    }
                    else if(self.itemSource !== "Direct Connection")
                        self.pullItems = !!self.pullItems;
                    if (self.showReaders && !self.readers)
                        return self.getReaders();
                    return self;
                }).finally(()=>$rootScope.statusMessage="");
            },
            getReaders: function () {
                return restCall({
                    url: `/project/${this.handle}/readers`
                }).then((readers) => {
                    this.readers = readers;
                    if (this.stage){
                        this.stage.showReaders(false);
                        this.stage.showReaders(this.showReaders);
                    }
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
                    }).catch((error)=> {console.log(error); self.jobMonitor=false;});
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
                    if (!self.isJobRunning() && self.itemSource === "Direct Connection")
                        self.pullItems = false;
                    return items;
                }).catch((err)=>{
                    self.pullItems = false;
                    return $q.reject(err);
                });
            },
            saveZoneMap(data){
                return restCall({
                    method: "POST",
                    url: "/project/" + this.handle + "/zones",
                    data: data
                });
            },
            addZoneMap: function (data) {
                return this.saveZoneMap(data).then((zoneMap) => {
                    this.zoneMaps = _.filter(this.zoneMaps,z=>z.name !== zoneMap.name).concat([zoneMap]);
                    this.zoneMap = zoneMap;
                    this.zones = zoneMap.zones;
                    return this.setCurrentZoneMap(zoneMap.name);
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
            getZoneMap(name){
                name = name? `/${name}` : "";
                return restCall({
                    url:`/project/${this.handle}/zones${name}`
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
                $rootScope.statusMessage="Getting Reader Status....";
                return restCall({
                    url: `/project/${this.handle}/llrp`
                }).finally(()=>{
                    $rootScope.statusMessage = "";
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
