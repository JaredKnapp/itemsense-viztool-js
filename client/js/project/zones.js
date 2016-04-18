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
                    project.zones = project.zones.concat(zone);
                    return zone;
                },
                cloneZoneName: function (name) {
                    const base = name.split("_copy")[0],
                        sameBase = _.filter(project.zones, z => z.name.split("_copy")[0] === base),
                        counter = _.map(sameBase, (z) => parseInt(z.name.split("_copy_")[1] || "0")).sort().pop();
                    return counter === undefined ? base : `${base}_copy_${counter + 1}`;
                },
                addZone: (points) => {
                    return project.updateZones(project, {
                        name: project.cloneZoneName("newZone"),
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
                }
            };
        }

        return (project) => {
            let zones = [],
                zone = null,
                tracePoints = null,
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
                        this.zones = v ? v.zones || [] : [];
                    }
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
