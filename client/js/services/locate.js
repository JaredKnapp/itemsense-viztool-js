/**
 * Created by ralemy on 1/14/17.
 */
"use strict";

module.exports = (function (app) {
    app.factory("LocateFactory", ["_", function (_) {

        let tree = null;

        function makeValidName(str) {
            return str.replace(/[^A-za-z0-9]/g, "_");
        }

        function collectImages(root) {
            let images = [];
            _.each(root.children, v => images = images.concat(collectImages(v)));
            root.images = _.uniq(root.ImageId ? images.concat(root.ImageId) : images);
            return root.images;
        }

        function findParentFacility(node) {
            if (node.Level === "Facility")
                return node;
            else if (node.parent)
                return findParentFacility(node.parent);
            else
                return null;
        }

        function createFacility(project, node, facilityNode) {
            if (!facilityNode) facilityNode = node;
            let name = makeValidName(facilityNode.Name);
            return project.callRest({url: `/project/${project.handle}/facility/${name}`, method: "POST"});
        }

        function getLeafZones(node, floor) {
            let makePoints = boundary =>
                _.map(JSON.parse(boundary)[0],
                    pair => {
                        return {x: Math.round10(pair[0], -2), y: Math.round10(pair[1], -2), z: 0};
                    });

            function gatherZones(node) {
                if (node.children)
                    return _.flatMap(node.children, gatherZones);
                if (!node.Boundary)
                    return null;
                let points = makePoints(node.Boundary);
                points.pop();
                return {
                    "name": node.AreaId,
                    "floor": floor,
                    "points": points
                };
            }

            return _.filter(gatherZones(node), n => n);
        }

        function removeBadArea(node, id) {
            if (node.AreaId === id) {
                console.log("Removing Conflicting Node ", id, node);
                delete node.parent.children[id];
            }
            else
                _.each(node.children, child => removeBadArea(child, id));
        }

        return {
            constructTree(areaArray) {
                let hashMap = _.reduce(areaArray, (result, area) => {
                    result[area.AreaId] = area;
                    return result;
                }, {});
                let tree = _.reduce(areaArray, (tree, area) => {
                    let parentId = area.ParentId;
                    if (!parentId) tree[area.AreaId] = area;
                    else {
                        let parent = hashMap[parentId];
                        if (!parent.children)
                            parent.children = {};
                        parent.children[area.AreaId] = area;
                        area.parent = parent;
                    }
                    return tree;
                }, {});
                _.each(tree, v => collectImages(v));
                return tree;
            },
            importFromLocate(project, node){
                let self = this;
                console.log("importing from locate node ", node);
                return project.callRest({url: `/locate/image/${node.images[0]}/${project.handle}`}
                ).then(success => {
                    project.floorPlan = `floorplan-${success.ImageId}.png`; //ToDo: get the type from the node object
                    project.scale = success.MapScale;
                    project.setOrigin(0, 1);
                    project.floorName = node.AreaId;
                    return createFacility(project, node, findParentFacility(node));
                }).then(faciltiy => {
                    project.facility = faciltiy.name;
                    return project.addZoneMap({
                        name: makeValidName(node.Name),
                        facility: project.facility,
                        zones: getLeafZones(node, project.floorName)
                    });
                }).catch(
                    error => {
                        console.log("Error importing zones ", error);
                        let badArea = "";
                        if (error.data &&
                            error.data.msg &&
                            error.data.msg.message) {
                            if (error.data.msg.message.indexOf("has invalid coordinates") > 0)
                                badArea = error.data.msg.message.match(/Zone[:]\s+(\S+)\s+has invalid/);
                            else if (error.data.msg.message.indexOf("overlap.") > 0)
                                badArea = error.data.msg.message.match(/Zones\s+(\S+)\s+and (\S+) overlap.$/);
                        }
                        if (badArea) {
                            badArea.shift();
                            console.log(error.data.msg.message, "Removing", badArea);
                            _.each(badArea, area => removeBadArea(node, area));
                            return self.importFromLocate(project, node);
                        }
                    });
            },
            getLocateAreas(project){
                return project.callRest({url: "/locate/areas"}).then(
                    success => {
                        tree = this.constructTree(success.Items);
                        return tree;
                    },
                    failure => console.log("failed getting from locate", failure)
                );
            },
            lastLocateAreas(){
                return tree;
            }
        };
    }]);
})(angular.module(window.mainApp));