var fs = require('fs');
var path = require('path');

function Plugin() {
    this.name = "base";
    this.uuid = "base";
    this.supported = {
        server: 1,
        search: 1,
    };
}

Plugin.prototype.bootstrap = function (env, cback) {

};

Plugin.prototype.listServer = function (args, cback) {

};

Plugin.prototype.search = function (args, cback) {

};


var Store = {};

function listServer(args, cback) {
    for (var uuid in Store) {
        var plugin = Store[uuid];
        try {
            if (plugin.supported.server) {
                plugin.listServer(args, cback);
            }
        } catch (e) {
            console.error("plugin: execute list server fail by plugin:", plugin, e);
        }
    }
}


function search(args, cback) {
    for (var uuid in Store) {
        var plugin = Store[uuid];
        if (plugin.supported.search) {
            plugin.search(args, cback);
        }
    }
}


function bootstrap(env, cback) {
    console.log("start load all plugin from " + env.plugins_dir);
    var bootdir = function (file, back) {
        var mpath = path.join(env.plugins_dir, file);
        mpath = path.resolve(mpath);
        fs.stat(mpath, function (err, stats) {
            if (err) {
                back(err);
                return;
            }
            if (!stats.isDirectory()) {
                back(null);
                return;
            }
            try {
                console.log("loading plugin from " + mpath);
                var plugin = require(mpath).create();
                if (!plugin.uuid) {
                    console.error("load plugin fail by " + JSON.stringify(plugin));
                    back(new Error("plugin uuid is not defined"));
                    return;
                }
                plugin.bootstrap(env, function (err) {
                    if (!err) {
                        console.log("load plugin success by " + JSON.stringify(plugin));
                        Store[plugin.uuid] = plugin;
                    }
                    back(err);
                });
            } catch (e) {
                console.log("loading plugin from " + mpath + " fail with ", e);
                back(err);
            }
        });
    };
    fs.readdir(env.plugins_dir, function (err, files) {
        if (err) {
            cback(err);
            return;
        }
        if (files.length < 1) {
            cback(null);
            return;
        }
        var idx = 0;
        var back = function (e) {
            idx++;
            if (idx < files.length) {
                bootdir(files[idx], back);
            } else {
                cback(null);
            }
        };
        bootdir(files[idx], back);
    });
}



exports.Plugin = Plugin;
exports.Store = Store;
exports.bootstrap = bootstrap;
exports.search = search;
exports.listServer = listServer;