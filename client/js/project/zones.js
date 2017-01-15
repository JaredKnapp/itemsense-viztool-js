/**
 * Created by ralemy on 4/16/16.
 * Zones and zonemaps on the project
 */
"use strict";
module.exports = (function (app) {
    app.factory("ProjectZones", ["_", function (_) {
        function newZoneMap(name, project) {
            return {
                name,
                facility: project.facility,
                zones: project.zoneMap ? [] : project.zones || []
            };
        }

        function wrap(project) {
            return {
                updateZones: (project, zone) => {
                    project.zones = project.zoneMap.zones = project.zones.concat(zone);
                    project.shouldSave.zones = true;
                    return zone;
                },
                cloneZoneName: function (name) {
                    const base = name.split("_copy")[0],
                        sameBase = _.filter(project.zones, z => z.name.split("_copy")[0] === base),
                        counter = _.map(sameBase, (z) => parseInt(z.name.split("_copy_")[1] || "0")).sort().pop();
                    return counter === undefined ? base : `${base}_copy_${counter + 1}`;
                },
                addZone: (points, name) => {
                    return project.updateZones(project, {
                        name: name || project.cloneZoneName("newZone"),
                        floor: project.floorName,
                        points: points
                    });
                },
                cloneZone(){
                    project.stage.selectZone(project.updateZones(project, {
                        name: project.cloneZoneName(project.zone.name),
                        floor: project.floorName,
                        points: project.zone.clone()
                    }));
                },
                deleteZone(){
                    
                    return project.stage ? project.stage.deleteZone() : null;
                },
                newZoneMap(name) {
                    project.addZoneMap(newZoneMap(name, project));
                },
                getZoneMapFloors(zoneMap){
                    const floors = _.reduce(zoneMap.zones,(r,zone)=>{
                        r[zone.floor] = true;
                        return r;
                    },{});
                    return Object.keys(floors);
                }
            };
        }

        return (project) => {
            let zones = [],
                zone = null,
                floors = [],
                floorName = null,
                tracePoints = null,
                facility = "",
                facilities = null,
                zoneMaps = null,
                zoneMap = null;

            _.each(wrap(project), (fn, key)=>project[key] = fn);

            Object.defineProperties(project, {
                zone: {
                    get: () => zone,
                    set: v => zone = v
                },
                zones: {
                    get: () => zones,
                    set: function (v) {
                        zones = v;
                        if (project.stage) project.stage.zones = v;
                    }
                },
                zoneMaps: {
                    get: () => zoneMaps,
                    set: v => zoneMaps = v
                },
                floors: {
                    get:()=> floors,
                    set: function(v){
                        floors = v;
                        if(this.floorName && !_.find(floors,f=>f===this.floorName))
                            floors.push(this.floorName);
                    }
                },
                floorName: {
                    enumerable: true,
                    get: () => floorName,
                    set: function (v) {
                        floorName = v;
                        if(v && !_.find(this.floors,f=>f===v))
                            this.floors.push(v);
                        if(this.stage)
                            this.stage.zones = this.zones;
                    }
                },
                _zoneMap: {
                    get: () => zoneMap,
                    set: function (v) {
                        this.zoneMap = v;
                        this.setCurrentZoneMap(zoneMap.name);
                    }
                },
                zoneMap: {
                    get: () => zoneMap,
                    set: function (v) {
                        zoneMap = v;
                        this.floors = v ? this.getZoneMapFloors(v):[];
                        this.zones = v ? v.zones || [] : [];
                    }
                },
                facility: {
                    enumerable: true,
                    get: () => facility,
                    set: (v) => facility = v
                },
                facilities: {
                    get: ()=> facilities,
                    set: v => facilities = v
                },
                tracePoints: {
                    get: () => tracePoints,
                    set: v => tracePoints = v
                }
            });
            return project;
        };
    }]);

})(angular.module(window.mainApp));
