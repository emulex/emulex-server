var emulex = require("libemulex-node");
var db = require("../db/db.js");
var plugins = require("./plugins.js");
var express = require('express');
var path = require("path");
var http = require('http');
var fs = require('fs');
var walk = require('walk');
var app = express();
require('express-ws')(app);
//
//websocket client
var wsc = [];
var edb = null;
var conf = {};
var hashing = false;

//
const FS_REMOVED = -1;
const FS_HASHING = 10;
const FS_HASHING_ERR = 11;
const FS_PENDING = 100;
const FS_PAUSED = 120;
const FS_DONE = 200;
const FS_OTHER_SHARED = 300;
const FS_SELF_SHARED = 310;
//
const SS_ED2K = 100;
const SS_KAD = 200;

const SP_TCP = 100;
const SP_UDP = 200;
const SP_TCP_UDP = 300;


function hashingProcess() {
    edb.search("ex_file", { status: FS_HASHING }, { pn: 0, ps: 1 }, function (err, fs) {
        if (err) {
            console.log("emulex: the search file fail with ", err);
            return;
        }
        if (fs.length < 1) {
            console.log("emulex: all file hash is done");
            return;
        }
        var filepath = path.join(fs[0].location, fs[0].filename);
        console.log("emulex: parsing hash for " + filepath);
        emulex.parse_hash({
            path: filepath,
            bmd4: true,
            bmd5: true,
            bsha1: true,
        }, function (err, hash) {
            hash.filepath = filepath;
            hash.tid = fs[0].tid;
            onHashingDone(err, hash);
        });
    });
}

function wsNotify(data) {
    wsc.forEach(function (ws) {
        try {
            ws.send(JSON.stringify(data));
        } catch (e) {
            console.log("emulex: send data to websocket fail with ", e.message);
        }
    });
}

function ed2kCallback(key, args) {
    if (key == "server_initialized") {
        wsNotify({
            type: "ed2k_initialized",
        });
    } else if (key == "server_shared") {
        onServerShared(args);
    } else if (key == "finished_transfer") {
        onEd2kUpdateTransfer({
            emd4: args.hash,
            status: FS_DONE,
            type: "transfer_status",
            name: args.name,
            save_path: args.save_path,
            size: args.size,
        });
    } else if (key == "resumed_data_transfer") {
        onEd2kUpdateTransfer({
            emd4: args.hash,
            status: FS_PENDING,
            type: "transfer_status",
        });
    } else if (key == "paused_data_transfer") {
        onEd2kUpdateTransfer({
            emd4: args.hash,
            status: FS_PAUSED,
            type: "transfer_status",
        });
    } else if (key == "deleted_data_transfer") {
        onEd2kRemoveTransfer({
            emd4: args.hash,
            status: FS_REMOVED,
            type: "transfer_status",
        });
    } else {
        console.log(key, args);
    }
}

function onHashingDone(err, res) {
    if (err) {
        console.error("emulex: parsing hash for " + filepath, err);
        edb.update("ex_file",
            {
                tid: res.tid,
            }, {
                status: FS_HASHING_ERR,
            }, function (terr, tres) {
                if (!terr && tres.changes) {
                    hashingProcess();
                }
                wsNotify({
                    type: "hash_done",
                    err: err + "",
                    filepath: res.filepath,
                });
            });
    } else {
        edb.update("ex_file",
            {
                tid: res.tid,
            }, {
                emd4: res.md4,
                md5: res.md5,
                sha: res.sha1,
                size: res.size,
                status: FS_SELF_SHARED,
            }, function (terr, tres) {
                if (!terr && tres.changes) {
                    hashingProcess();
                    emulex.add_transfer({
                        hash: res.md4,
                        size: res.size,
                        path: res.filepath,
                        seed: true,
                    });
                }
                wsNotify({
                    type: "hash_done",
                    err: terr + "",
                    filepath: res.filepath,
                });
            });
    }
}

function onServerShared(args) {
    if (!args) {
        return;
    }
    var donc = args.length;
    var addback = function (err, res) {
        donc--;
        if (donc < 1) {
            wsNotify({
                type: "file_found",
            });
        }
        if (err) {
            console.error("emulex: add shared file fail with error", err);
        }
    };
    args.forEach(function (file) {
        console.log("emulex: add shared file to db by ", file);
        edb.upsert("ex_file", {
            filename: file.name,
            size: file.size,
            emd4: file.hash,
            status: FS_OTHER_SHARED,
        }, addback);
    });
}

function onEd2kUpdateTransfer(args) {
    console.log("emulex: the ed2k update transfer by " + JSON.stringify(args));
    edb.update("ex_file",
        {
            emd4: args.emd4,
        }, {
            status: args.status,
        }, function (err, res) {
            if (err) {
                console.error("emulex: update the task to done fail with error by ", args.hash, err);
                return;
            }
            wsNotify(args);
        });
}

function onEd2kRemoveTransfer(args) {
    edb.remove("ex_file",
        {
            emd4: args.hash,
        }, function (err, res) {
            if (err) {
                console.error("emulex: remove the task to done fail with error by ", args.hash, err);
                return;
            }
            console.log("emulex: remove the task by ", args.hash);
            wsNotify(args);
        });

}

function onServerFound(err, ss) {
    if (err) {
        console.log("emuelx: on server found receive error ", err);
        return;
    }
    if (!(ss && ss.length)) {
        return;
    }
    ss.forEach(function (srv) {
        edb.unique("ex_server", {
            addr: srv.addr,
            port: srv.port,
        }, srv, function (err, back) {
            if (err) {
                console.log("emulex: upsert server fail by ", srv, err);
                return;
            }
            if (!back.changes) {
                return;
            }
            switch (srv.type) {
                case SS_ED2K:
                    emulex.ed2k_server_connect(srv.name, srv.addr, srv.port, !emulex.connected);
                    emulex.connected = true;
                    break;
                case SS_KAD:
                    emulex.ed2k_add_dht_node(srv.addr, srv.port, srv.uuid);
                    break;
            }
        });
    });
}

function addTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var task = {
            done: 0,
            used: 0,
            task: 1,
            status: FS_PENDING,
        };
        if (req.query.hash) {
            task.emd4 = req.query.hash;
        } else {
            throw new Error("hash argument is required");
        }
        if (req.query.filename) {
            task.filename = req.query.filename;
            task.format = path.extname(task.filename);
        } else {
            throw new Error("filename argument is required");
        }
        if (req.query.location) {
            task.location = path.resolve(req.query.location);
        } else {
            throw new Error("location argument is required");
        }
        if (req.query.size) {
            task.size = parseInt(req.query.size);
        } else {
            throw new Error("size argument is required");
        }
        edb.upsert("ex_file", task, function (err, back) {
            try {
                if (err) {
                    console.log("emulex: add task fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    emulex.add_transfer({
                        hash: task.emd4,
                        size: task.size,
                        path: path.join(task.location, task.filename),
                    });
                    res.send(JSON.stringify({ code: 0, tid: back.lastID, msg: "OK" }));
                }
            } catch (e) {
                console.log("emulex: add task fail with ", e);
                res.send(JSON.stringify({ code: 1, msg: e.message }));
            }
            res.end();
        });
    } catch (e) {
        console.log("emulex: add task fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function pauseTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var hash = "";
        if (req.query.hash) {
            hash = req.query.hash;
        } else {
            throw new Error("hash argument is required");
        }
        emulex.pause_transfer({
            hash: hash,
        });
        res.send(JSON.stringify({ code: 0, msg: "OK" }));
        res.end();
    } catch (e) {
        console.log("emulex: pause task fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}


function resumeTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var hash = "";
        if (req.query.hash) {
            hash = req.query.hash;
        } else {
            throw new Error("hash argument is required");
        }
        emulex.resume_transfer({
            hash: hash,
        });
        res.send(JSON.stringify({ code: 0, msg: "OK" }));
        res.end();
    } catch (e) {
        console.log("emulex: resume task fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function removeTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var hash = "";
        if (req.query.hash) {
            hash = req.query.hash;
        } else {
            throw new Error("hash argument is required");
        }
        emulex.remove_transfer({
            hash: hash,
        });
        res.send(JSON.stringify({ code: 0, msg: "OK" }));
        res.end();
    } catch (e) {
        console.log("emulex: remove task fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function listTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var query = { task: 1 };
        if (req.query.status) {
            query.status = new db.Raw('(' + req.query.status + ')');
            query._status = "IN";
        }
        edb.search("ex_file", query, function (err, back) {
            if (err) {
                console.log("emulex: list task fail with ", err);
                res.send(JSON.stringify({ code: 2, msg: "" + err }));
            } else {
                res.send(JSON.stringify({ code: 0, tasks: back, msg: "OK" }));
            }
            res.end();
        });
    } catch (e) {
        console.log("emulex: list task fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function addServer(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var server = {};
        if (req.query.name) {
            server.name = req.query.name;
        } else {
            throw new Error("name argument is required");
        }
        if (req.query.addr) {
            server.addr = req.query.addr;
        } else {
            throw new Error("addr argument is required");
        }
        if (req.query.port) {
            server.port = parseInt(req.query.port);
        } else {
            throw new Error("port argument is required");
        }
        if (req.query.type) {
            server.type = parseInt(req.query.type);
        } else {
            throw new Error("type argument is required");
        }
        if (req.query.description) {
            server.description = req.query.description;
        }
        server.protocol = SP_TCP;
        server.tryc = 0;
        server.last = 0;
        edb.add("ex_server", server, function (err, back) {
            try {
                if (err) {
                    console.log("emulex: add server fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    emulex.ed2k_server_connect(server.name, server.addr, server.port, !emulex.connected);
                    res.send(JSON.stringify({ code: 0, tid: back.lastID, msg: "OK" }));
                }
            } catch (e) {
                console.log("emulex: add server fail with ", e);
                res.send(JSON.stringify({ code: 1, msg: e.message }));
                res.end();
            }
        });
    } catch (e) {
        console.log("emulex: add server fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function listServer(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        edb.search("ex_server", {}, function (err, back) {
            try {
                if (err) {
                    console.log("emulex: list server fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    res.send(JSON.stringify({ code: 0, servers: back, msg: "OK" }));
                }
            } catch (e) {
                console.log("emulex: list server fail with ", e);
                res.send(JSON.stringify({ code: 1, msg: e.message }));
                res.end();
            }
        });
    } catch (e) {
        console.log("emulex: list server fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function searchFile(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var args = {};
        if (req.query.query) {
            args.filename = "%" + req.query.query + "%";
            args._filename = "like";
        } else {
            throw new Error("query argument is required");
        }
        if (req.query.format) {
            args.format = req.query.format;
        }
        var delay = 2000;
        if (req.query.delay) {
            delay = parseInt(req.query.delay);
        }
        var remote = 1;
        if (req.query.remote) {
            remote = parseInt(req.query.remote);
        }
        // if (req.query.max_size) {
        //     args.max_size = parseInt(req.query.max_size);
        // }
        var dosearch = function () {
            edb.search("ex_file", args, function (err, fs) {
                if (err) {
                    console.log("emulex: search file fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    console.log('emulex: search file while ' + fs.length + " found by ", args);
                    res.send(JSON.stringify({ code: 0, fs: fs, msg: "OK" }));
                }
            });
        };
        if (remote) {
            emulex.search_file({ query: req.query.query });
            setTimeout(function () {
                dosearch();
            }, delay);
        } else {
            dosearch();
        }
    } catch (e) {
        console.log("emulex: search file fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function shareFiles(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var filepath = "";
        if (req.query.path) {
            filepath = req.query.path;
        } else {
            throw new Error("path argument is required");
        }
        filepath = path.normalize(path.resolve(filepath));
        var isdir = req.query.isdir && req.query.isdir == "1" ? 1 : 0;
        console.log("emulex: share files by filepath:" + filepath + ",isdir:" + isdir);
        if (isdir) {
            var added = 0;
            var walker = walk.walk(filepath, {
                followLinks: false,
                filters: [".DS_Store"],
            });
            walker.on("file", function (root, stats, next) {
                edb.unique("ex_file",
                    {
                        location: root,
                        filename: stats.name,
                    }, {
                        location: root,
                        filename: stats.name,
                        format: path.extname(stats.name),
                        size: stats.size,
                        status: FS_HASHING,
                    }, function (err, res) {
                        if (err) {
                            console.error("emulex: add hasing file by " + root + "," + stats.name, err);
                        } else {
                            added += 1;
                        }
                        next();
                    });
            });
            walker.on("end", function () {
                res.send(JSON.stringify({ code: 0, msg: "", added: added }));
                res.end();
                hashingProcess();
            });
            return;
        }
        fs.stat(filepath, function (err, stats) {
            if (err) {
                console.log("emulex: file path stat by " + filepath + " fail with ", e);
                res.send(JSON.stringify({ code: 1, msg: e.message }));
                res.end();
                return;
            }
            if (stats.isDirectory()) {
                res.send(JSON.stringify({ code: 3, msg: "file is directory" }));
                res.end();
                return;
            }
            edb.unique("ex_file",
                {
                    location: path.dirname(filepath),
                    filename: path.basename(filepath),
                }, {
                    location: path.dirname(filepath),
                    filename: path.basename(filepath),
                    format: path.extname(filepath),
                    size: stats.size,
                    status: FS_HASHING,
                }, function (err, res) {
                    if (err) {
                        console.error("emulex: add hasing file by " + path.dirname(filepath) + "," + path.basename(filepath), err);
                    } else {
                        added += 1;
                    }
                    res.send(JSON.stringify({ code: 0, msg: "", added: added }));
                    res.end();
                    hashingProcess();
                });
        });
    } catch (e) {
        console.log("emulex: share file fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function listShared(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var status = "(" + FS_HASHING + "," + FS_HASHING_ERR + "," + FS_SELF_SHARED + ")";
        edb.search("ex_file",
            {
                status: new db.Raw(status),
                _status: "IN",
            }, function (err, ds) {
                if (err) {
                    console.log("emulex: list shared file fail with ", err);
                    res.send(JSON.stringify({ code: 1, msg: err.message }));
                    res.end();
                    return;
                }
                res.send(JSON.stringify({ code: 0, msg: "OK", fs: ds }));
                res.end();
            });
    } catch (e) {
        console.log("emulex: share file fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

function importNodeDat(path) {
    var ns = emulex.load_node_dat(path);
    ns.forEach(function (node) {
        db.upsert("ex_server", {
            uuid: node.id,
            addr: node.address,
            port: node.udp_port,
            type: SS_KAD,
            protocol: SP_UDP,
        }, function (err, res) {
            if (err) {
                console.log("emulex: add kad node to db fail with ", err);
                return;
            }
            emulex.ed2k_add_dht_node(node.address, node.udp_port, node.id);
        });
    });
}

function importServerMet(path) {
    var ns = emulex.load_server_met(path);
    ns.forEach(function (node) {
        db.upsert("ex_server", {
            name: node.name,
            addr: node.address,
            port: node.port,
            type: SS_ED2K,
            protocol: SP_TCP,
        }, function (err, res) {
            if (err) {
                console.log("emulex: add ed2k server to db fail with ", err);
                return;
            }
            emulex.ed2k_server_connect(node.name, node.address, node.port, !emulex.connected);
        });
    });
}

function importHttpData(url, type, cback) {
    var tmpf = path.join(conf.tmp, "tmp_" + new Date().getTime() + ".dat");
    var file = fs.createWriteStream(tmpf);
    var err = null;
    file.on("open", function () {
        http.get(url, function (response) {
            response.on("error", function (e) {
                file.close();
                err = e;
            });
            response.pipe(file);
        });
    }).on("error", function (e) {
        cback(e);
    }).on("finish", function () {
        file.close();
        if (err) {
            cback(err);
            return;
        }
        switch (type) {
            case "nodes.dat":
                importNodeDat(tmpf);
                break;
            case "server.met":
                importServerMet(tmpf);
                break;
        }
        fs.unlink(tmpf);
        cback(null);
    });

}

function importData(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var url = "";
        if (req.query.url) {
            url = req.query.url;
        } else {
            throw new Error("url argument is required");
        }
        var type = "";
        if (req.query.type) {
            type = req.query.type;
        } else {
            throw new Error("type argument is required");
        }
        importHttpData(url, type, function (err) {
            if (err) {
                console.log("emulex: import data from " + url + " as " + type + " fail with ", err);
                res.send(JSON.stringify({ code: 1, msg: err.message }));
                res.end();
            } else {
                console.log("emulex: import data from " + url + " as " + type + " success");
                res.send(JSON.stringify({ code: 0, msg: "OK" }));
                res.end();
            }
        })
    } catch (e) {
        console.log("emulex: import data fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

var transfer_timer = null;
function notifyTransfer() {
    try {
        var ts = emulex.list_transfer();
        wsNotify({
            type: "transfer",
            ts: ts,
        });
        console.log("notify->", ts);
    } catch (e) {
        console.log("emulex: notify transfer fail with ", e);
    }
}
function transferNotify(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        var duration = 3000;
        if (req.query.duration) {
            duration = parseInt(req.query.duration);
        }
        if (transfer_timer) {
            clearInterval(transfer_timer);
        }
        transfer_timer = setInterval(notifyTransfer, duration);
        res.send(JSON.stringify({ code: 0, msg: "OK" }));
        res.end();
    } catch (e) {
        console.log("emulex: notify transfer fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

app.get('/exec/share_files', shareFiles);
app.get('/exec/list_shared', listShared);
app.get('/exec/add_task', addTask);
app.get('/exec/pause_task', pauseTask);
app.get('/exec/resume_task', resumeTask);
app.get('/exec/remove_task', removeTask);
app.get('/exec/list_task', listTask);
app.get('/exec/search_file', searchFile);
app.get('/exec/add_server', addServer);
app.get('/exec/list_server', listServer);
app.get('/exec/import', importData);
app.get('/exec/transfer_notify', transferNotify);
// app.get('/exec/add_transfer', addTransfer);

app.ws('/emulex', function (ws, req) {
    ws.on('message', function (msg) {
        console.log(msg);
    });
    ws.on('close', function () {
        delete wsc[ws];
    });
    wsc.push(ws);
    console.log('socket', req.testing);
});

function execListServer() {
    plugins.listServer({}, onServerFound);
}

function initServer() {
    edb.search("ex_server", { type: [SS_ED2K, SS_KAD] }, function (err, back) {
        if (err) {
            console.log("emulex: list server fail with ", err);
            return;
        }
        console.log("emulex: having " + back.length + " server or node");
        if (back.length < 1) {
            emulex.connected = false;
            return;
        }
        back.forEach(function (srv, idx) {
            switch (srv.type) {
                case SS_ED2K:
                    emulex.ed2k_server_connect(srv.name, srv.addr, srv.port, !emulex.connected);
                    emulex.connected = true;
                    break;
                case SS_KAD:
                    emulex.ed2k_add_dht_node(srv.addr, srv.port, srv.uuid);
                    break;
            }
        });
    });
}

function initSharedFile() {
    edb.search("ex_file", { status: FS_SELF_SHARED }, function (err, ds) {
        if (err) {
            console.log("emulex: list server fail with ", err);
            return;
        }
        console.log("emulex: having " + ds.length + " file shared");
        if (ds.length < 1) {
            return;
        }
        ds.forEach(function (f) {
            emulex.add_transfer({
                hash: f.emd4,
                size: f.size,
                path: path.join(f.location, f.filename),
                seed: true,
            });
        });
    });
}

function bootstrap(conf_, cback) {
    conf = conf_;
    console.log("emulex: loading by configure->\n", conf);
    db.open(conf.dbpath, function (err, tdb) {
        if (err) {
            cback(err, null);
            return;
        }
        edb = tdb;
        emulex.connected = false;
        emulex.bootstrap({
            ed2k: {
                port: conf.ed2k_port,
                // callback: function (key, args) {
                //     if (key == "portmap") {
                //         //initServer();
                //     } else if (key == "portmap_error") {
                //         //initServer();
                //     } else {
                //         ed2kCallback(key, args);
                //     }
                // },
                callback: ed2kCallback,
            },
        });
        initServer();
        initSharedFile();
        plugins.bootstrap({
            edb: edb,
            conf: conf_,
            plugins_dir: conf_.plugins_dir,
        }, function () {
            setTimeout(execListServer, 10);
            hashingProcess();
        });
        cback(null, edb);
    });
}

function listen(conf) {
    app.listen(conf.port);
}

function addMonitor(ws) {
    wsc.push(ws);
}
function removeMonitor(ws) {
    delete wsc[ws];
}
function shutdown() {
    emulex.shutdown();
    edb.close();
}


exports.app = app;
exports.bootstrap = bootstrap;
exports.listen = listen;
exports.shutdown = shutdown;
exports.addMonitor = addMonitor;
exports.removeMonitor = removeMonitor;