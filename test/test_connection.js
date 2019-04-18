var hazelcast = require('../index');

var client = null;

hazelcast.getOrCreateClient()
    .then((c)=> {
        client = c;
        console.log("Client Connected!");

        client.isConnected()
            .then(() => {
                console.log("Client is Connected to Hazelcast Cluster");
            })
            .catch(() => {
                console.log("Client is NOT Connected to Hazelcast Cluster");
            })

        client.getConnectionManager().on('clusterConnectionLost', () => {
            console.log("Lost hazelcast cluster");
            process.exit(-1);
        });

        setTimeout(() => {
            client.shutdown();
            console.log("Client Stopped");
        },60000);
    })
    .catch((err) => {
        console.log("Fail to connecto to cluster " + err.message);
        process.exit(-1);
    });