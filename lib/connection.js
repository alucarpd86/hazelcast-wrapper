const hazelcastInstance = require('hazelcast-client');

const defaultConfig = {
    "group": {
        "name": "hazel",
        "password": "cast"
    },
    "properties": {
        "hazelcast.client.heartbeat.timeout": 60000,
        "hazelcast.client.heartbeat.interval": 5000,
        "hazelcast.client.invocation.retry.pause.millis": 1000,
        "hazelcast.client.invocation.timeout.millis": 120000,
        "hazelcast.invalidation.reconciliation.interval.seconds": 60,
        "hazelcast.invalidation.max.tolerated.miss.count": 10,
        "hazelcast.invalidation.min.reconciliation.interval.seconds": 30
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
    configuration = require('merge').recursive(defaultConfig, conf);

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

    if (configuration.serialization && configuration.serialization.portableVersion) {
        clientConfig.serializationConfig.portableVersion = configuration.serialization.portableVersion;
        for (var factoryId in configuration.serialization.portableFactories) {
            clientConfig.serializationConfig.portableFactories[factoryId] = configuration.serialization.portableFactories[factoryId];
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
            return hzClient;
        })
        .catch((err) => {
            logger.error("HazelcastClient","Client is not connected to the cluster. Emit clusterConnectionLost event. Message: " + err.message);
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