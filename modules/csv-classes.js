/**
 * Created by ralemy on 11/24/15.
 * testing parsing of the csv files
 */

var csv = require("fast-csv"),
    _ = require("lodash"),
    q = require("q"),
    fs = require("fs"),
    path = require("path");

function createDictionary() {
    var hash = {},
        classes = {},
        tree={};
    return Object.create({
        add: function (row) {
            var self = this,
                prevRow=tree;
            row.EPC = row.EPC.toUpperCase();
            hash[row.EPC] = row;
            _.each(row, function (v, k) {
                if(k==="EPC") return;
                self.pivot(k, v);
                if(!prevRow[k])
                    prevRow[k]={};
                if(!prevRow[k][v])
                    prevRow[k][v]={};
                prevRow = prevRow[k][v];
            });
        },
        pivot: function (k, v) {
            if (!classes[k])
                classes[k] = [];
            if (!this.find(classes[k], v))
                classes[k].push(v);
        },
        find: function (array, v) {
            return _.find(array, function (symbol) {
                return symbol === v;
            });
        }
    }, {
        hash: {
            enumerable: true,
            get: function () {
                return hash;
            },
            set: function (v) {
                hash = v;
            }
        },
        classes: {
            enumerable: true,
            get: function () {
                return classes;
            },
            set: function (v) {
                classes = v;
            }
        },
        tree:{
            enumerable:true,
            get:function(){
                return tree;
            },
            set:function(v){
                tree=v;
            }
        }
    });
}

function trimRow(row) {
    return _.reduce(row, function (r, v, k) {
        r[k.trim()] = v.trim();
        return r;
    }, {});
}

function parseCSV(path, parse,result) {
    var defer = q.defer(),
        stream = fs.createReadStream(path)
            .pipe(csv.parse({headers: true}))
            .transform(function (row) {
                return trimRow(row);
            })
            .on("readable", function () {
                var row = null;
                while (null !== (row = stream.read()))
                    parse(row);
            })
            .on("error", function (err) {
                defer.reject(err);
            })
            .on("end", function () {
                defer.resolve(result);
            });
    return defer.promise;
}

module.exports = {
    classes: function(path){
        var dic = createDictionary();
        return parseCSV(path,function(row){
            dic.add(row);
        },dic);
    },
    symbols:function(path){
        var symbols={};
        return parseCSV(path,function(row){
            symbols[row.Property.toLowerCase()]=row;
        },symbols);
    }
};
