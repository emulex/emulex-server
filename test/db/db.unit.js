var sql = require("../../db/db.js");
var fs = require("fs");
var as = require("assert");
describe('db', function () {
    it("init", function (done) {
        try {
            fs.unlinkSync(__dirname + "/test.dat");
        } catch (e) {

        }
        sql.open(__dirname + "/test.dat", function (err, db) {
            as.equal(err, null);
            db.run("INSERT INTO EX_ENV VALUES('abc','a1','b1','c1','d1')", function (err) {
                as.equal(err, null);
                db.all("SELECT * FROM EX_ENV", function (err, rows) {
                    as.equal(err, null);
                    as.equal(rows.length, 1);
                    db.close();
                    done();
                });
            });
        });
    });
    it("reopen", function (done) {
        sql.open(__dirname + "/test.dat", function (err, db) {
            as.equal(err, null);
            db.all("SELECT * FROM EX_ENV", function (err, rows) {
                as.equal(err, null);
                as.equal(rows.length, 1);
                db.close();
                done();
            });
        });
    });
    it("crud", function (done) {
        sql.open(__dirname + "/test.dat", function (err, db) {
            console.log("crud: db is opened");
            as.equal(err, null);
            var donc = 0;
            var listback2 = function (err, rows) {
                as.equal(err, null);
                as.equal(rows.length, 50);
                done();
            };
            var removeback = function (err, res) {
                as.equal(err, null);
                as.equal(res.changes, 50);
                db.search("ex_file", {}, listback2);
            };
            var listback = function (err, rows) {
                as.equal(err, null);
                as.equal(rows.length, 5);
                db.remove("ex_file", {
                    size: 51,
                    _size: "<",
                }, removeback);
            };
            var updateback = function (err, res) {
                as.equal(err, null);
                //console.log(res);
                donc++;
                if (donc < 100) {
                    return;
                }
                db.search("ex_file", {
                    filename: "name%",
                    _filename: "like",
                    format: ".txt",
                    size: 50,
                    _size: "<",
                    status: 5,
                }, listback);
            };
            var addback = function (err, res) {
                as.equal(err, null);
                // console.log(res);
                db.update("ex_file",
                    {
                        tid: res.lastID,
                    },
                    {
                        filename: "name-" + res.lastID,
                    },
                    updateback);
            };
            for (var i = 0; i < 100; i++) {
                db.add("ex_file", {
                    sha: "sha_" + i,
                    md5: "md5_" + i,
                    emd4: "md4_" + i,
                    filename: "file-" + i,
                    size: i + 1,
                    format: ".txt",
                    status: i % 10,
                }, addback);
            }
            // db.all("SELECT * FROM EX_ENV", function (err, rows) {
            //     as.equal(err, null);
            //     as.equal(rows.length, 1);
            //     db.close();
            //     done();
            // });
        });
    });
});