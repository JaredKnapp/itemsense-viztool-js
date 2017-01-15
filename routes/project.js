/**
 * Created by ralemy on 11/2/15.
 * functions for upload files and floorplans and project crud operations
 */

const express = require("express"),
    fs = require("fs-extra"),
    path = require("path"),
    multer = require("multer"),
    through = require("through2"),
    util = require("../modules/util"),
    thread = require("../modules/thread"),
    csv = require("../modules/csv-classes"),
    upload = multer({dest: util.getProjectDir()}),
    q = require("q"),
    router = express.Router();


function getAllProjects(start) {
    var items = [],
        defer = q.defer();
    fs.walk(start)
        .pipe(through.obj(function (item, enc, next) {
            try {
                if (item.stats.isDirectory())
                    this.push(fs.readJSONSync(getProjectFileName(item.path)));
            } catch (e) {
            }
            next();
        }))
        .on("data", function (item) {
            items.push(item);
        })
        .on("end", function () {
            defer.resolve(items);
        });
    return defer.promise;
}

function getProjectFileName(p) {
    return path.resolve(p, "project.json");
}

function resolveProjectFile(id) {
    return getProjectFileName(util.getProjectDir(id));
}

function threadError(err, r) {
    console.log("thread error", err,r);
    return {
        status: err.payload.data.statusCode || r.status,
        msg: err.payload.data.response.body || ""
    };
}

function fileError(err, r) {
    console.log("file Error",err,err.payload);
    return {
        status: err.code === "ENOENT" ? 404 : r.status,
        msg: err.message || r.msg
    };
}

function handleError(err, res, fn) {
    var r = {
        status: 500,
        msg: err ? err.message || err : "No more info"
    };
    try {
        r = fn(err, r);
    } catch (e) {
        console.log("exception in error processing", e);
    }
    console.log("Error in Rest call ", err, r);
    res.status(r.status).json(r);
}

function addDefaultFloorPlan(body){
    const filename = path.resolve(util.getProjectDir(body.handle),"default.png"),
        defaultBackground= path.resolve(util.getProjectDir(body.handle),"..","..","images","default.png");
    body.scale=125;
    body.origin = {x:627,y:373};
    body.zoom = 0.771;
    body.floorPlan = "default.png";
    console.log("filename",filename, defaultBackground);
    fs.copySync(defaultBackground,filename);
}
function saveProject(fileName, body) {
    var defer = q.defer();
    if(body.floorPlan === null)
        addDefaultFloorPlan(body);
    fs.outputJSON(fileName, body, defer.makeNodeResolver());
    return defer.promise;
}

function deleteFile(fileName) {
    var defer = q.defer();
    fs.remove(fileName, defer.makeNodeResolver());
    return defer.promise;
}

function readProject(fileName) {
    var defer = q.defer();
    fs.readJSON(fileName, defer.makeNodeResolver());
    return defer.promise;
}

router.get("/", function (req, res) {
    getAllProjects(util.getProjectDir(".")).then(function (items) {
        res.json(items);
    }, function (err) {
        handleError(err, res, fileError);
    });
});

router.post("/", function (req, res) {
    var fileName = path.resolve(util.getProjectDir(req.body.handle), "project.json");
    saveProject(fileName, req.body)
        .then(()=> thread.updateProcess (req.body), err => handleError(err,res,fileError))
        .then(()=> res.json(req.body), err => handleError(err,res,threadError));
});

router.get("/:projectId", function (req, res) {
    readProject(resolveProjectFile(req.params.projectId)).then(function (result) {
        res.json(result);
    }, function (err) {
        handleError(err, res, fileError);
    });
});

router.delete("/:projectId",function(req,res){
    const id =req.params.projectId;
    deleteFile(util.getProjectDir(id)).then(()=>{
        thread.stopProcess(id).catch(()=>{});
    }).then(function(result){
        res.json(result);
    },function(err){
        handleError(err,res,fileError);
    });
});
const getMime = file => file.mimetype.substr(file.mimetype.lastIndexOf("/") + 1);

function getChunk(target, temp, flow) {
    const buffer = fs.readFileSync(temp);
    fs.unlinkSync(temp);
    if (flow.flowChunkNumber === '1')
        fs.writeFileSync(target, buffer, {encoding: null});
    else
        fs.appendFileSync(target, buffer, {encoding: null});
    return flow.flowChunkNumber === flow.flowTotalChunks;
}

function setupDestination(req, key) {
    const target = path.resolve(req.file.destination, req.params.projectId, key);
    fs.ensureDirSync(target);
    return target;
}

function uploadCSV(key, req, res) {
    const destination = `epc-${key}.${getMime(req.file)}`,
        target = path.resolve(setupDestination(req, "epc"), destination);
    if (getChunk(target, req.file.path, req.body))
        csv[key](target).then((result)=>res.json(result),
            (err) => {
                console.log(`error uploading ${key} csv`, err);
                res.status(500).send(err)
            });
    else
        res.sendStatus(204);
}

function uploadItem(key, req, res) {
    const destination = `${key}-${req.params.itemId}.${getMime(req.file)}`,
        target = path.resolve(setupDestination(req, key), destination);
    if (getChunk(target, req.file.path, req.body))
        res.json({filename: destination});
    else
        res.sendStatus(204);
}

router.get("/:projectId/upload/*", (req, res) => res.sendStatus(204));

router.post("/:projectId/upload/:itemId", upload.single("file"), function (req, res) {
    const destination = `floorplan-${req.params.itemId}.${getMime(req.file)}`,
        target = path.resolve(setupDestination(req,""), destination);
    getChunk(target, req.file.path, req.body);
    res.json({filename: destination});
});

router.get("/:projectId/csv/*", (req, res) => res.sendStatus(204));

router.post("/:projectId/csv/classes", upload.single("file"), uploadCSV.bind(null, "classes"));

router.post("/:projectId/csv/symbols", upload.single("file"), uploadCSV.bind(null, "symbols"));

router.get("/:projectId/symbols/*", (req, res) => res.sendStatus(204));

router.post("/:projectId/symbols/:itemId", upload.single("file"), uploadItem.bind(null, "symbols"));

router.get("/:projectId/icon/*", (req, res) => res.sendStatus(204));

router.post("/:projectId/icon/:itemId", upload.single("file"), uploadItem.bind(null, "icon"));

router.get("/:projectId/avatar/*", (req, res) => res.sendStatus(204));

router.post("/:projectId/avatar/:itemId", upload.single("file"), uploadItem.bind(null, "avatar"));


router.post("/:projectId/connect", function (req, res) {
    thread.updateProcess(req.body).then(function (response) {
        res.json(response.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});


function threadCall(command, body, req, res) {
    var id = req.params.projectId;
    thread.invoke(id, {
        command: command,
        data: body ? req.body : req.params.itemId
    }).then(
        data => res.json(data.payload.data),
        err => handleError(err, res, threadError));
}

router.get("/:projectId/job/:itemId", threadCall.bind(null, "monitorJob", false));

router.post("/:projectId/job", threadCall.bind(null, "startJob", true));

router.delete("/:projectId/job/:itemId", threadCall.bind(null, "stopJob", false));

router.get("/:projectId/items", threadCall.bind(null, "getItems", false));

router.get("/:projectId/readers", threadCall.bind(null, "getReaders", false));

router.post("/:projectId/readers", threadCall.bind(null, "postReaders", true));

router.get("/:projectId/zones/:itemId", threadCall.bind(null, "getZoneMap", false));

router.post("/:projectId/zones", threadCall.bind(null, "addZoneMap", true));

router.post("/:projectId/zones/:itemId", threadCall.bind(null, "setCurrentZoneMap", false));

router.delete("/:projectId/zones/:itemId", threadCall.bind(null, "deleteZoneMap", false));

router.get("/:projectId/llrp", threadCall.bind(null, "getLLRPStatus", false));

router.get("/:projectId/facilities", threadCall.bind(null, "getFacilities", false));

router.post("/:projectId/facility/:itemId", threadCall.bind(null,"addFacility",false));

router.post("/:projectId/facilities", function (req, res) {
    const itemsenseApi = util.connectToItemsense(req.body.url,req.body.user,req.body.password);
    return itemsenseApi.facilities.get().then(
        facilities => res.json(facilities),
        err => handleError(err,res,threadError)
    );
});

router.get("/:projectId/dump", threadCall.bind(null, "dumpConfig", false));

module.exports = router;

