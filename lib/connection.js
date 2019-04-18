const hazelcastInstance = require('hazelcast-client');

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

var hzClient = null;
var logger = null;
var configuration = {};

function getOrCreateClient(conf) {
    if (hzClient) {
        return isConnected();
    }
    configuration = Object.assign({}, defaultConfig, conf);

    var Config = hazelcastInstance.Config;
    var clientConfig = new Config.ClientConfig();
    clientConfig.groupConfig.name = configuration.group.name;
    clientConfig.groupConfig.password = configuration.group.password;
    clientConfig.networkConfig.smartRouting = configuration.network.smartRouting;
    clientConfig.networkConfig.redoOperation = configuration.network.redoOperation;
    clientConfig.networkConfig.connectionTimeout = configuration.network.connectionTimeout;
    clientConfig.networkConfig.connectionAttemptPeriod = configuration.network.connectionAttemptPeriod;
    clientConfig.networkConfig.connectionAttemptLimit = configuration.network.connectionAttemptLimit;
    for (var propName in configuration.properties) {
        if (configuration.properties.hasOwnProperty(propName))
            clientConfig.properties[propName] = configuration.properties[propName];
    }
    clientConfig.networkConfig.addresses = configuration.network.clusterMembers;

    if (clientConfig.serialization && clientConfig.serialization.portableVersion) {
        clientConfig.serializationConfig.portableVersion = clientConfig.serialization.portableVersion;
        for (var factoryId in clientConfig.serialization.portableFactories) {
            clientConfig.serializationConfig.portableFactories[factoryId] = clientConfig.serialization.portableFactories[factoryId];
        }
    }

    return hazelcastInstance.Client.newHazelcastClient(clientConfig)
        .then((client) => {
            hzClient = client;
            logger = hzClient.getLoggingService().getLogger();
            addUtilities(hzClient);
            return hzClient;
        });
}

function isConnected() {
    if (!hzClient) return Promise.reject();
    return hzClient.getAtomicLong("ConnectionChecker")
        .then((aLong) => {
            return aLong.get();
        })
        .then(() => {
            logger.info("HazelcastClient","Client is connected to the cluster");
            return hzClient;
        })
        .catch((err) => {
            logger.error("HazelcastClient","Client is not connected to the cluster. Emit clusterConnectionLost event.");
            hzClient.getConnectionManager().emit('clusterConnectionLost');
            resetVariables();
        });
}

function addUtilities(hzClient) {
    hzClient.getConnectionManager().on('connectionClosed', () => {
        logger.warn("HazelcastClient","Lost connection to one member of the hazelcast cluster. Checking cluster availability...");
        return isConnected();
    }) ;
    hzClient.isConnected = isConnected;
}

function resetVariables() {
    hzClient = null;
    logger = null;
    configuration = {};
}

module.exports = {
    getOrCreateClient:getOrCreateClient,
    isConnected:isConnected
};