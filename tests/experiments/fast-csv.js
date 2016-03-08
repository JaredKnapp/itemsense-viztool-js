/**
 * Created by ralemy on 11/24/15.
 * testing parsing of the csv files
 */

var csv = require("fast-csv"),
    _ = require("lodash"),
    fs = require("fs"),
    path = require("path");

var dic = {};

function trimRow(row) {
    return _.reduce(row, function (r, v, k) {
        r[k.trim()] = v.trim();
        return r;
    }, {});
}

function addToDic(dic, row) {
    dic[row.EPC] = row;
}
var stream = fs.createReadStream(path.resolve(__dirname, "pictures.csv"))
    .pipe(csv.parse({headers: true}))
    .transform(function (row) {
        return trimRow(row);
    })
    .on("readable", function () {
        var row = null;
        while (null !== (row = stream.read())) {
            console.log("row=>", row);
        }
    })
    .on("end", function () {
        console.log("ended", arguments);
        process.exit();
    });