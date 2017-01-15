/**
 * Created by ralemy on 1/14/17.
 */
"use strict";

module.exports = (function (app) {
    app.factory("LocateFactory", ["_", function (_) {

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
                        return {x: pair[0], y: -pair[1], z: 0};
                    });

            function gatherZones(node) {
                if (node.children)
                    return _.flatMap(node.children, gatherZones);
                if (!node.Boundary)
                    return null;
                return {
                    "name": node.AreaId,
                    "floor": floor,
                    "points": makePoints(node.Boundary)
                };
            }

            return _.filter(gatherZones(node), n => n);
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
                console.log("importing from locate node ", node);
                project.callRest({url: `/locate/image/${node.images[0]}/${project.handle}`}
                ).then(success => {
                    project.floorPlan = `floorplan-${success.ImageId}.png`; //ToDo: get the type from the node object
                    project.scale = success.scale;
                    project.setOrigin(0, 0);
                    project.floorName = node.AreaId;
                    return createFacility(project, node, findParentFacility(node));
                }).then(faciltiy => {
                    project.facility = facility.name;
                    return project.addZoneMap({
                        name: makeValidName(node.Name),
                        facility: project.facility,
                        zones: getLeafZones(node)
                    });
                }).catch(
                    error => console.log("Error saving image as background ", error)
                );
            }
        };
    }]);
})(angular.module(window.mainApp));