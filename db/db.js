var sqlite3 = require('sqlite3').verbose();
var fs = require("fs");

function checkEmulexDb(db, cback) {
    db.run("SELECT COUNT(*) FROM EX_FILE", function (err, rows) {
        if (err) {
            console.log("db: the db is not initialed, will init the database.");
            var sql = fs.readFileSync(__dirname + "/crebas.sql", "utf-8");
            var bs = sql.split(";");
            var ridx = 0;
            var loop = function () {
                if (ridx >= bs.length) {
                    cback(null);
                    return;
                }
                var block = bs[ridx];
                block = block.trim();
                if (block.length < 1) {
                    ridx++;
                    loop();
                    return;
                }
                console.log("\n<--Executing-->\n" + block);
                db.run(block, function (err) {
                    if (err) {
                        console.log("db: execute error:" + err);
                        cback(err);
                    } else {
                        ridx++;
                        loop();
                    }
                });
            };
            loop();
        } else {
            console.log("db: the db is initialed");
            cback();
        }
    });
}
function buildWhere(args) {
    var sql = "";
    for (var key in args) {
        if (key.charAt(0) == '_') {
            continue;
        }
        if (Object.prototype.toString.call(args[key]) == "[object Array]") {
            var vals = "";
            for (var i = 0; i < args[key].length; i++) {
                if (typeof args[key][i] == "string") {
                    vals += ",'" + args[key][i] + "'";
                } else {
                    vals += "," + args[key][i];
                }
            }
            sql += " AND " + key + " IN (" + vals.substring(1) + ") ";
        } else if (typeof args[key] == "string") {
            if (args["_" + key]) {
                sql += " AND " + key + " " + args["_" + key] + " '" + args[key] + "' ";
            } else {
                sql += " AND " + key + " = '" + args[key] + "' ";
            }
        } else {
            if (args["_" + key]) {
                sql += " AND " + key + " " + args["_" + key] + " " + args[key] + " ";
            } else {
                sql += " AND " + key + "=" + args[key] + " ";
            }
        }
    }
    sql = sql.substring(4);
    if (sql.length) {
        return sql;
    } else {
        return " 1=1 ";
    }
}
function open(file, cback) {
    var db = new sqlite3.Database(file);
    db.showlog = 1;
    db.serialize(function (err) {
        checkEmulexDb(db, function () {
            cback(err, db);
        });
    });
    db.search = function (name, args, cback) {
        var sql = "SELECT * FROM " + name + " F WHERE " + buildWhere(args);
        if (db.showlog) {
            console.log("DB: execute search by " + sql);
        }
        db.all(sql, cback);
    };
    db.add = function (name, args, cback) {
        var keys = "tid";
        var vals = "null";
        for (var key in args) {
            if (typeof args[key] == "string") {
                keys += "," + key;
                vals += ",'" + args[key] + "'";
            } else {
                keys += "," + key;
                vals += "," + args[key];
            }
        }
        var sql = "INSERT INTO " + name + " (" + keys + ") VALUES (" + vals + ")";
        if (db.showlog) {
            console.log("DB: execute add by " + sql);
        }
        db.run(sql, function (err) {
            cback(err, {
                lastID: this.lastID,
                changes: this.changes,
            });
        });
    };
    db.upsert = function (name, args, cback) {
        var keys = "tid";
        var vals = "null";
        for (var key in args) {
            if (typeof args[key] == "string") {
                keys += "," + key;
                vals += ",'" + args[key] + "'";
            } else {
                keys += "," + key;
                vals += "," + args[key];
            }
        }
        var sql = "INSERT OR REPLACE INTO " + name + " (" + keys + ") VALUES (" + vals + ")";
        if (db.showlog) {
            console.log("DB: execute add by " + sql);
        }
        db.run(sql, function (err) {
            cback(err, {
                lastID: this.lastID,
                changes: this.changes,
            });
        });
    };
    db.update = function (name, args, update, cback) {
        var sets = "";
        for (var key in update) {
            if (typeof update[key] == "string") {
                sets += "," + key + "='" + update[key] + "'";
            } else {
                sets += "," + key + "=" + update[key] + " ";
            }
        }
        var sql = "UPDATE " + name + " SET " + sets.substring(1) + " WHERE " + buildWhere(args);
        if (db.showlog) {
            console.log("DB: execute update by " + sql);
        }
        db.run(sql, function (err) {
            cback(err, {
                changes: this.changes,
            });
        });
    };
    db.remove = function (name, args, cback) {
        var sql = "DELETE FROM " + name + " WHERE " + buildWhere(args);
        if (db.showlog) {
            console.log("DB: execute remove by " + sql);
        }
        db.run(sql, function (err) {
            cback(err, {
                changes: this.changes,
            });
        });
    };
}
exports.open = open;