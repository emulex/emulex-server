var emulex = require("libemulex-node");
var db = require("../db/db.js");
var express = require('express');
var path = require("path");
var app = express();
require('express-ws')(app);
//
//websocket client
var wsc = [];
var edb = null;

const FS_PENDING = 100;
const FS_DONE = 200;
const FS_SHARED = 300;

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
        onFinishedTransfer(args);
    } else {
        console.log(key, args);
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
            status: FS_SHARED,
        }, addback);
    });
}

function onFinishedTransfer(args) {
    edb.update("ex_file",
        {
            emd4: args.hash,
        }, {
            status: FS_DONE,
        }, function (err, res) {
            if (err) {
                console.error("emulex: update the task to done fail with error by ", args.hash, err);
            } else {
                console.log("emulex: update the task to done by ", args.hash);
            }
            wsNotify({
                type: "finished_transfer",
                name: args.name,
                save_path: args.save_path,
                emd4: args.hash,
                size: args.size,
            });
        });
}

function share(req, res) {

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
            task.location = req.query.location;
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

function listTask(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
        edb.search("ex_file", { task: 1 }, function (err, back) {
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
        server.tryc = 0;
        server.last = 0;
        edb.add("ex_server", server, function (err, back) {
            try {
                if (err) {
                    console.log("emulex: add server fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    emulex.ed2k_server_connect(server.name, server.addr, server.port, true);
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
        // if (req.query.max_size) {
        //     args.max_size = parseInt(req.query.max_size);
        // }
        emulex.search_file({ query: req.query.query });
        setTimeout(function () {
            edb.search("ex_file", args, function (err, fs) {
                if (err) {
                    console.log("emulex: search file fail with ", err);
                    res.send(JSON.stringify({ code: 2, msg: "" + err }));
                } else {
                    console.log('emulex: search file while ' + fs.length + " found by ", args);
                    res.send(JSON.stringify({ code: 0, fs: fs, msg: "OK" }));
                }
            });
        }, delay);
    } catch (e) {
        console.log("emulex: search file fail with ", e);
        res.send(JSON.stringify({ code: 1, msg: e.message }));
        res.end();
    }
}

app.get('/exec/add_task', addTask);
app.get('/exec/list_task', listTask);
app.get('/exec/search_file', searchFile);
app.get('/exec/add_server', addServer);
app.get('/exec/list_server', listServer);
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

function bootemulex(conf, cback) {
    db.open(conf.dbpath, function (err, tdb) {
        if (err) {
            cback(err, null);
            return;
        }
        edb = tdb;
        emulex.bootstrap({
            ed2k: {
                port: conf.ed2k_port,
                callback: ed2kCallback,
            },
        });
        cback(null, edb);
    });
}
function bootstrap(conf) {
    console.log("emulex: loading by configure->\n", conf);
    bootemulex(conf, function () { });
    app.listen(conf.port);
}

function addMonitor(ws) {
    wsc.push(ws);
}
exports.app = app;
exports.bootstrap = bootstrap;
exports.bootemulex = bootemulex;
exports.addMonitor = addMonitor;