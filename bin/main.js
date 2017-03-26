var conf = require("../conf/config.js").conf;
var emulex = require("../lib/emulex.js");
emulex.bootstrap(conf, function (err) {
    if (err) {
        return;
    }
    emulex.listen(conf);
});