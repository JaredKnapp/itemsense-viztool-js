/**
 * Created by ralemy on 1/19/17.
 */
"use strict";

module.exports = (function (app) {
    function wrap(stage) {
        let inventoryItems = {};
        return {

            removeItemFromZone(epc){
                let zone  = inventoryItems[epc];

            },

            addItemToZone(zone){
                let stageZone = stage.getStageZoneByName(zone.readerZone);
            },

            checkInventoryZone(item, zone) {
                let match = item.zone.match(/(.+)_[-\d.]+_[-\d.]+$/);
                if (!match) return null;
                zone.zone = this.getStageZone(match[1]);
                zone.x = match[2];
                zone.y = match[3];
                zone.readerZone = item.zone;
                return zone;
            },

            handleInventoryItem(item){
                let zone = {};
                if (item.xLocation !== null) return item;
                if (!this.checkInventoryZone(item, zone)) return null;
                if (inventoryItems[item.epc])
                    if (inventoryItems[item.epc].readerZone !== item.zone)
                        this.removeItemFromZone(item.epc);
                    else
                        return item;
                inventoryItems[item.epc] = zone;
                this.addItemToZone(zone);
            }
        };
    }

    app.factory("Inventory", ["_",function (_) {
        return function (stage) {
            _.each(wrap(stage), (fn,key) => stage[key] = fn);
            stage.itemHandlers.push(stage.handleInventoryItem)
        }
    }]);
})(angular.module(window.mainApp));
