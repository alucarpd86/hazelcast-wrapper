# hazelcast-wrapper
Wrapper for the hazelcast-client library.

```bash
npm install @alucarpd86/hazelcast-wrapper
```

Why? in the stock library are missing:

- a method to check the connection status
- an event that inform when the library lost connection to all member of the hazelcst cluster

How to initialize the wrapper:

```js
var hazelcast = require("hazelcast-wrapper");
```

You can connect to hazelcast with the new method:

```js
hazelcast.getOrCreateClient(conf)
    .then((client) => {
        console.log("Connected!");
        ...
    })
    .catch((err) => {
        console.log("Hazelcast cluster not reachable!");
    });
```

If the getOrCreateClient method is called without any parameter, the defaults are:

```js
const defaultConfig = {
    "group": {
        "name": "hazel",
        "password": "cast"
    },
    "properties": {
        "hazelcast.client.heartbeat.timeout": 10000,
        "hazelcast.client.invocation.retry.pause.millis": 4000,
        "hazelcast.client.invocation.timeout.millis": 180000,
        "hazelcast.invalidation.reconciliation.interval.seconds": 50,
        "hazelcast.invalidation.max.tolerated.miss.count": 10,
        "hazelcast.invalidation.min.reconciliation.interval.seconds": 60
    },
    "network": {
        "clusterMembers": [
            "127.0.0.1:5701"
        ],
        "smartRouting": true,
        "redoOperation": false,
        "connectionTimeout": 5000,
        "connectionAttemptPeriod": 3000,
        "connectionAttemptLimit": 2
    },
    "serialization": {
        "portableVersion": null,
        "portableFactories": {}
    }
};
```

Each time the method getOrCreateClient is called, always the same client instance is returned.

This client has as 2 additional features:

1- isConnected method that returns a promise:

```js
client.isConnected()
    .then(() => {
        console.log("Client is Connected to Hazelcast Cluster");
    })
    .catch(() => {
        console.log("Client is NOT Connected to Hazelcast Cluster");
    });
```

2- raise an additional events when the client loose the connection to all cluster member

```js
client.getConnectionManager().on('clusterConnectionLost', () => {
        console.log("Lost connection to all hazelcast cluster members!");
    });
```