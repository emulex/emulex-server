var as = require("assert");
function Plugin() {
    this.name = "test";
    this.uuid = "test";
    this.supported = {
        server: 1,
        search: 1,
    };
}

Plugin.prototype.bootstrap = function (env, cback) {
    console.log(env);
    as.equal(env.abc, 1);
    cback(null);
};

Plugin.prototype.listServer = function (args, cback) {
    console.log(args);
    as.equal(args.type, 1);
    cback(null, [
        {
            name: "test",
        }
    ]);
};

Plugin.prototype.search = function (args, cback) {
    console.log(args);
    as.equal(args.query, "abc");
    cback(null, [
        {
            filename: "test.txt",
        }
    ]);
};

function create() {
    return new Plugin();
}

exports.create = create;