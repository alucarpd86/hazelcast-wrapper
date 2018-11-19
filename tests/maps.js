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
var mapName = "My_map";
var mapKey = "my_key";
var mapValue = "my_value";

hazelcast.forge(conf)
    .then((result) => {
        assert.ok(result.started);
        hazelcast.getMap(mapName).put(mapKey,mapValue)
            .then(()=> {
                hazelcast.getMap(mapName).get(mapKey)
                    .then((value) => {
                        assert.equal(mapValue,value);
                        hazelcast.destroyMap(mapName)
                            .then(()=> {
                                hazelcast.stop()
                                    .then((res) => {
                                        assert.ok(!res.started);
                                    })
                                    .catch(printError)
                                    .finally(() => {
                                        process.exit(0);
                                    });
                            }).catch(printError);
                    }).catch(printError);
            }).catch(printError);
    }).catch(printError);

function printError(err) {
    console.log("KO: " + err.message, JSON.stringify(err, null, 2));
}