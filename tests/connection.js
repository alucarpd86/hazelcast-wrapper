const assert = require("assert");

var hazelcast = require('../index');

var conf = {
    "name": "WCS_Group",
    "password": "WCS_Group_Secret",
    "addresses": [
        {
            "host": "127.0.0.1",
            "port": "4401"
        }
    ]
};

hazelcast.forge(conf)
    .then((result) => {
        assert.ok(result.started);
        hazelcast.stop()
            .then((res) => {
                assert.ok(!res.started);
            })
            .finally(() => {
                process.exit(0);
            })
    })
    .catch((err) => {
        console.log("KO", JSON.stringify(err, null, 2));
    });