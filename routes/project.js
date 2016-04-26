/**
 * Created by ralemy on 11/2/15.
 * functions for upload files and floorplans and project crud operations
 */

var express = require("express"),
    fs = require("fs-extra"),
    path = require("path"),
    multer = require("multer"),
    through = require("through2"),
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            var d = getProjectDir(req.params.projectId);
            if (req.uploadTarget)
                d = path.resolve(d, req.uploadTarget);
            fs.ensureDirSync(d);
            req.savePath = d;
            cb(null, d);
        },
        filename: function (req, file, cb) {
            var prefix = req.uploadTarget || "floorplan";
            req.savedAs = prefix + "-" + req.params.itemId + "." + file.mimetype.substr(file.mimetype.lastIndexOf("/") + 1);
            cb(null, req.savedAs);
        }
    }),
    upload = multer({storage: storage}),
    thread = require("../modules/thread"),
    csv = require("../modules/csv-classes"),
    q = require("q"),
    router = express.Router();

function getProjectDir(projectId) {
    return path.resolve(path.dirname(__dirname), "public", "projects", projectId);
}

function promiseUpload(req, res) {
    var defer = q.defer();
    try {
        upload.single("file")(req, res, defer.makeNodeResolver());
    } catch (e) {
        defer.reject(e);
    }
    return defer.promise;
}

function uploadFile(req, res) {
    return promiseUpload(req, res).then(function () {
        res.json({filename: req.savedAs});
    }, function (err) {
        console.log("upload error", err);
        var msg;
        try {
            msg = typeof err === "object" ? JSON.stringify(err) : err.toString();
        } catch (e) {
            msg = err.toString();
        }
        res.status(500).send(msg);
    });
}

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
    return getProjectFileName(getProjectDir(id));
}
function threadError(err, r) {
    return {
        status: err.payload.data.statusCode || r.status,
        msg: err.payload.data.response.body || ""
    };
}

function fileError(err, r) {
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

function saveProject(fileName, body) {
    var defer = q.defer();
    fs.outputJSON(fileName, body, defer.makeNodeResolver());
    return defer.promise;
}

function readProject(fileName) {
    var defer = q.defer();
    fs.readJSON(fileName, defer.makeNodeResolver());
    return defer.promise;
}

router.get("/", function (req, res) {
    getAllProjects(getProjectDir(".")).then(function (items) {
        res.json(items);
    }, function (err) {
        handleError(err, res, fileError);
    });
});

router.post("/", function (req, res) {
    var fileName = path.resolve(getProjectDir(req.body.handle), "project.json");
    saveProject(fileName, req.body).then(function (result) {
        res.json(result);
    }, function (err) {
        handleError(err, res, fileError);
    })
});

router.get("/:projectId", function (req, res) {
    readProject(resolveProjectFile(req.params.projectId)).then(function (result) {
        res.json(result);
    }, function (err) {
        handleError(err, res, fileError);
    });
});

router.get("/:projectId/upload/*", function (req, res) {
    res.sendStatus(204);
});

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

router.get("/:projectId/csv/*", function (req, res) {
    res.sendStatus(204);
});

router.post("/:projectId/csv/classes", function (req, res) {
    req.uploadTarget = "epc";
    req.params.itemId = "classes";
    promiseUpload(req, res).then(function () {
        console.log("succeeded upload", req.savePath, req.savedAs);
        return csv.classes(path.resolve(req.savePath, req.savedAs));
    }).then(function (dic) {
        res.json(dic);
    }, function (err) {
        console.log("error uploading", err);
        res.status(500).send(err);
    });
});

router.post("/:projectId/csv/symbols", function (req, res) {
    req.uploadTarget = "epc";
    req.params.itemId = "symbols";
    promiseUpload(req, res).then(function () {
        console.log("succeeded upload", req.savePath, req.savedAs);
        return csv.symbols(path.resolve(req.savePath, req.savedAs));
    }).then(function (dic) {
        res.json(dic);
    }, function (err) {
        console.log("error uploading", err);
        res.status(500).send(err);
    });
});

router.get("/:projectId/symbols/*", function (req, res) {
    res.sendStatus(204);
});

router.post("/:projectId/symbols/:itemId", function (req, res) {
    req.uploadTarget = "symbols";
    uploadFile(req, res);
});

router.get("/:projectId/icon/*", function (req, res) {
    res.sendStatus(204);
});

router.post("/:projectId/icon/:itemId", function (req, res) {
    req.uploadTarget = "icon";
    uploadFile(req, res);
});

router.get("/:projectId/avatar/*", function (req, res) {
    res.sendStatus(204);
});

router.post("/:projectId/avatar/:itemId", function (req, res) {
    req.uploadTarget = "avatar";
    uploadFile(req, res);
});

router.post("/:projectId/connect", function (req, res) {
    thread.updateProcess(req.body).then(function (response) {
        res.json(response.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.get("/:projectId/job/:jobId", function (req, res) {
    var id = req.params.projectId;
    thread.invoke(id, {command: "monitorJob", data: req.params.jobId}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.post("/:projectId/job", function (req, res) {
    var id = req.params.projectId;
    return thread.invoke(id, {command: "startJob", data: req.body}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.delete("/:projectId/job/:jobId", function (req, res) {
    var id = req.params.projectId;
    thread.invoke(id, {command: "stopJob", data: req.params.jobId}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.get("/:projectId/zones/:itemId", threadCall.bind(null, "getZoneMap", false));


router.get("/:projectId/readers", function (req, res) {
    var id = req.params.projectId;
    thread.invoke(id, {command: "getReaders"}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.post("/:projectId/readers", function (req, res) {
    var id = req.params.projectId;
    thread.invoke(id, {command: "postReaders", data: req.body}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.get("/:projectId/zones",function(req,res){
    var id = req.params.projectId;
    thread.invoke(id, {command: "getZoneMaps"}).then(function (data) {
        res.json(data.payload.data);
    }, function (err) {
        handleError(err, res, threadError);
    });
});

router.post("/:projectId/zones",function(req,res){
    var id=req.params.projectId;
    thread.invoke(id,{command:"addZoneMap",data:req.body}).then(function(data){
        res.json(data.payload.data);
    },function(err){
        handleError(err,res,threadError);
    });
});

router.post("/:projectId/zones/:mapName",function(req,res){
    var id=req.params.projectId;
    thread.invoke(id,{command:"setCurrentZoneMap",data:req.params.mapName}).then(function(data){
        res.json(data.payload.data);
    },function(err){
        handleError(err,res,threadError);
    });
});


module.exports = router;

