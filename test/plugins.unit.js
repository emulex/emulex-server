var plugins = require("../lib/plugins.js");
var as = require("assert");
describe('plugins', function () {
    it("bootstrap", function (done) {
        plugins.bootstrap({
            abc: 1,
            plugins_dir: __dirname + "/plugins",
        }, function (err) {
            as.equal(err, null);
            console.log(plugins.Store);
            as.equal(plugins.Store.test && true, true);
            done();
        });
    });
    it("listServer", function (done) {
        plugins.listServer({
            type: 1,
        }, function (err, ss) {
            as.equal(ss.length, 1);
            done();
        });
    });
    it("search", function (done) {
        plugins.search({
            query: "abc",
        }, function (err, fs) {
            as.equal(fs.length, 1);
            done();
        });
    });
});