var emulex = require("../lib/emulex.js");
var app = emulex.app;
var as = require("assert");
var request = require('supertest');
var fs = require("fs");
var WebSocketClient = require('websocket').client;
describe('emulex', function () {
    var edb = null;
    it("bootstrap", function (done) {
        try {
            fs.unlinkSync(__dirname + "/emulex.db");
        } catch (e) {

        }
        emulex.bootstrap({
            port: 4227,
            ed2k_port: 14227,
            dbpath: __dirname + "/emulex.db",
        }, function (err, tdb) {
            as.equal(err, null);
            edb = tdb;
            done();
        });
    });
    it("server", function (realdone) {
        var donc = 0;
        function done() {
            donc--;
            console.log("test server done " + donc);
            if (donc < 1) {
                realdone();
            }
        }
        //
        donc++;
        request(app)
            .get("/exec/add_server?name=&addr=a.loc.w&port=4122&type=1")
            .end(function (err, res) {
                as.equal(err, null);
                console.log(res.body);
                done();
            });
        //
        donc++;
        request(app)
            .get("/exec/add_server?name=xxx&addr=&port=4122&type=1")
            .end(function (err, res) {
                as.equal(err, null);
                console.log(res.body);
                done();
            });
        //
        donc++;
        request(app)
            .get("/exec/add_server?name=testing&addr=a.loc.w&port=&type=1")
            .end(function (err, res) {
                as.equal(err, null);
                console.log(res.body);
                done();
            });
        //
        donc++;
        request(app)
            .get("/exec/add_server?name=testing&addr=a.loc.w&port=4122&type=")
            .end(function (err, res) {
                as.equal(err, null);
                console.log(res.body);
                done();
            });
    });
    it("donwload", function (done) {
        try {
            fs.unlinkSync("abc.txt");
        } catch (e) {
        }
        var monitor = {
            send: function (data) {
                console.log("notify-->", data);
                var vals = JSON.parse(data);
                if (vals.type == "ed2k_initialized") {
                    searchfile();
                } else if (vals.type == "file_found") {
                    listfile();
                } else if (vals.type == "finished_transfer") {
                    listtask();
                }
            }
        };
        emulex.addMonitor(monitor);
        //
        var addserver = function () {
            request(app)
                .get("/exec/add_server?name=testing&addr=a.loc.w&port=4122&type=100&description=description")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body);
                    //done();
                });
        };
        //
        var searchfile = function () {
            request(app)
                .get("/exec/search_file?query=abc.txt&delay=1000")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body, res.body.code);
                    as.equal(res.body.code, 0);
                });
        };
        var listfile = function () {
            console.log("execute--->listfile");
            request(app)
                .get("/exec/search_file?query=abc.txt&delay=1000")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body, res.body.code);
                    as.equal(res.body.code, 0);
                    as.equal(res.body.fs.length, 1);
                    var file = res.body.fs[0];
                    request(app)
                        .get("/exec/add_task?hash=" + file.emd4 + "&filename=" + file.filename + "&location=.&size=" + file.size)
                        .end(function (err, res) {
                            as.equal(err, null);
                            as.equal(res.body.code, 0);
                            console.log(res.body);
                            // done();
                        });
                    // done();
                });
        };
        var listserver = function () {
            request(app)
                .get("/exec/list_server")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body, res.body.code);
                    as.equal(res.body.code, 0);
                    as.equal(res.body.servers.length, 1);
                    emulex.removeMonitor(monitor);
                    done();
                });
        };
        var listtask = function () {
            request(app)
                .get("/exec/list_task")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body, res.body.code);
                    as.equal(res.body.code, 0);
                    as.equal(res.body.tasks.length, 1);
                    var task = res.body.tasks[0];
                    as.equal(task.status, 200);
                    listserver();
                });
        };
        addserver();
    });
    it("shutdown", function (done) {
        emulex.shutdown();
        setTimeout(function () {
            done();
        }, 3000);
    });
    it("restart", function (done) {
        emulex.bootstrap({
            port: 4227,
            ed2k_port: 14227,
            dbpath: __dirname + "/emulex.db",
        }, function (err, tdb) {
            as.equal(err, null);
            edb = tdb;
        });
        try {
            fs.unlinkSync("abc.txt");
        } catch (e) {
        }
        var monitor = {
            send: function (data) {
                console.log("notify-->", data);
                var vals = JSON.parse(data);
                if (vals.type == "ed2k_initialized") {
                    searchfile();
                } else if (vals.type == "finished_transfer") {
                    emulex.shutdown();
                    done();
                }
            }
        };
        emulex.addMonitor(monitor);
        var searchfile = function () {
            request(app)
                .get("/exec/search_file?query=abc.txt&delay=1000&remote=0")
                .end(function (err, res) {
                    as.equal(err, null);
                    console.log(res.body, res.body.code);
                    as.equal(res.body.code, 0);
                    as.equal(res.body.fs.length, 1);
                    var file = res.body.fs[0];
                    request(app)
                        .get("/exec/add_task?hash=" + file.emd4 + "&filename=" + file.filename + "&location=.&size=" + file.size)
                        .end(function (err, res) {
                            as.equal(err, null);
                            as.equal(res.body.code, 0);
                            console.log(res.body);
                            // done();
                        });
                });
        };
    });
});