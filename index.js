const Promise = require('promise');
const d3 = require('d3-queue');
const hazelcastInstance = require('hazelcast-client');

const enumUtil = require('./enum');
var HazelcastClient = null;
var started = false;

//Timeout per la riconnessione
var reconnectTimer = null;
//Mi segno se almeno una volta mi sono connesso a cluster
var firstConnectionSuccess = false;
//Mappa di tutti i listener hazelcast creati
var listenersMap = {};
var reconnectionListenersMap = {};


module.exports = {
    getMap: getMap,
    getLock: getLock,
    getQueue : getQueue,
    destroyQueue: destroyQueue,
    destroyMap: destroyMap,

    forge: forge,

    forceReleaseLock : forceReleaseLock,
    getDistributedLocks: getDistributedLocks,
    stop: stop,
    isStarted: isStarted,

    addEntryListener: addEntryListener,
    removeEntryListener: removeEntryListener,
    addItemListener: addItemListener,
    removeItemListener: removeItemListener,
    addReconnectionListener: addReconnectionListener,
    removeReconnectionListeners: removeReconnectionListeners
};

function getMap(name) {
    if (started) {
        return HazelcastClient.getMap(name);
    }
    return null;
}

function getLock(name) {
    if (started) {
        return HazelcastClient.getLock(name);
    }
    return null;
}

function getQueue(name) {
    if (started) {
        return HazelcastClient.getQueue(name);
    }
    return null;
}

function destroyQueue(name) {
    if (started) {
        return HazelcastClient.getQueue(name).destroy();
    }
    return Promise.reject("Fail to destroy queue because hazelcast is not started");
}

function destroyMap(name) {
    if (started) {
        return HazelcastClient.getMap(name).destroy();
    }
    return Promise.reject("Fail to destroy map because hazelcast is not started");
}

function forge(conf) {
    //Se non viene passata la conf restituisco lo stato di hazelcast
    if (!started) {
        var Config = hazelcastInstance.Config;
        var config = new Config.ClientConfig();

        config.groupConfig.name = conf.name;
        config.groupConfig.password = conf.password;
        config.networkConfig.addresses = conf.addresses;
        config.networkConfig.smartRouting = conf.smartRouting || true;
        config.properties["hazelcast.client.heartbeat.interval"] = conf.heartbeatInterval || 5000;
        config.properties["hazelcast.client.heartbeat.timeout"] = conf.heartbeatTimeout || 60000;
        console.log("Starting cluster with addresses " + JSON.stringify(config.networkConfig.addresses));
        return hazelcastInstance.Client.newHazelcastClient(config)
            .then(function (client) {
                console.log("cluster started!");
                HazelcastClient = client;

                //Gestione eventi di connessione chiusa e riaperta. Miservono per gestire la riconnessione manualmente
                HazelcastClient.getConnectionManager().on('connectionClosed', function () {
                    console.log("Hazelcast client connectionClosed. Scheduled reconnection in 10 seconds...");
                    started = false;
                    reconnectTimer = setTimeout(function () {
                        console.log("Hazelcast reconnection...");
                        forge(conf);
                    }, 10000);
                    notifyReconnectionListeners(enumUtil.HazelcastConnectionStatus.DISCONNECTED);
                });
                HazelcastClient.getConnectionManager().on('connectionOpened', onConnectionRestored );

                started = true;
                if (!firstConnectionSuccess) {
                    firstConnectionSuccess = true;
                    notifyReconnectionListeners(enumUtil.HazelcastConnectionStatus.CONNECTED);
                } else {
                    onConnectionRestored();
                }
                return Promise.resolve({started: true});
            })
            .catch(function (err) {
                started = false;
                if (!firstConnectionSuccess) {
                    console.log("cluster failed to start", err);
                    return Promise.reject({started: false, err: err});
                } else {
                    console.log("Failed reconnection. Scheduled reconnection in 10 seconds...", err);
                    reconnectTimer = setTimeout(function () {
                        console.log("Hazelcast reconnection...");
                        return forge(conf);
                    }, 10000);
                }
            });
    }
    return Promise.resolve({started: started});
}

function onConnectionRestored() {
    console.log("Hazelcast client connectionOpened");
    started = true;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    setTimeout(function() {
        notifyReconnectionListeners(enumUtil.HazelcastConnectionStatus.RECONNECTED);
        var regenListenerQueue = d3.queue(3);
        var newListenersMap = {};
        console.log("Listener to restore", Object.keys(listenersMap));
        for (var mapName in listenersMap) {
            for (var listenerId in listenersMap[mapName]) {
                if (listenersMap[mapName].hasOwnProperty(listenerId)) {
                    console.log("Restoring listener " + listenerId + " on map " + mapName);
                    var listenerFunction = listenersMap[mapName][listenerId];
                    regenListenerQueue.defer(function(mapNameInternal, listenerFunctionInternal, callback) {
                        getMap(mapNameInternal).addEntryListener(listenerFunctionInternal, null, true)
                            .then(function (newListenerId) {
                                if (!newListenersMap[mapNameInternal]) newListenersMap[mapNameInternal] = {};
                                newListenersMap[mapNameInternal][newListenerId] = listenerFunctionInternal;
                                console.log("New listener " + newListenerId + " on map " + mapNameInternal + " restored! typeof " + (typeof listenerFunctionInternal));
                            }.bind(this))
                            .catch(function(err) {
                                console.log("fail to restore listener " + listenerId + " on map " + mapNameInternal + "! typeof " + (typeof listenerFunctionInternal), err);
                            }.bind(this))
                            .finally(function() {
                                callback();
                            });
                    }.bind(this), mapName, listenerFunction);
                }
            }
        }
        regenListenerQueue.awaitAll(function() {
            console.log("Restored all listeners!");
            listenersMap = newListenersMap;
        }.bind(this));
    }, 500);
}

function forceReleaseLock(name) {
    var lock = HazelcastClient.getLock(name);
    if (lock) {
        return lock.isLocked()
            .then(function (result) {
                if (result) {
                    return lock.forceUnlock();
                } else {
                    return Promise.reject("Not locked");
                }
            });
    } else {
        return Promise.reject("Not connected");
    }
}

function getDistributedLocks() {
    if (started) {
        HazelcastClient.getDistributedObjects()
            .then(function(objects) {
                var arrayOfPromise = [];
                var result = {};
                for (var i=0; i<objects.length; i++) {
                    if (objects[i].serviceName.indexOf('lock')!==-1) {
                        result[objects[i].name] = 0;
                        arrayOfPromise.push(HazelcastClient.getLock(objects[i].name));
                    }
                }
                return Promise.all(arrayOfPromise)
                    .then(function(listOfLock) {
                        var keys = Object.keys(result);
                        keys.forEach(function(key, index) {
                            result[key] = listOfLock[index];
                        });
                        return result;
                    });
            });
    } else {
        console.log("Invoked getDistributedObjects on cluster with started=" + started);
        Promise.resolve("No active locks found");
    }
}

function stop() {
    if (started) {
        started = false;
        console.log("Stopping cluster");
        if (HazelcastClient && HazelcastClient.shutdown) {
            HazelcastClient.shutdown();
            return Promise.resolve({started: false});
        }
    }
    return Promise.resolve({started: false});
}

function isStarted() {
    return started;
}

function addEntryListener(mapName, listener) {
    return getMap(mapName).addEntryListener(listener, null, true)
        .then(function(listenerId) {
            if (!listenersMap[mapName]) {
                listenersMap[mapName] = {};
            }
            console.log("AddEntryListener " + listenerId + " on map " + mapName);
            listenersMap[mapName][listenerId] = listener;
            return listenerId;
        });
}

function removeEntryListener(mapName, listenerId) {
    return getMap(mapName).removeEntryListener(listenerId)
        .then(function() {
            delete listenersMap[mapName][listenerId];
        });
}

function addItemListener(queueName, listener) {
    return getQueue(queueName).addItemListener(listener, true)
        .then(function(listenerId) {
            if (!listenersMap[queueName]) {
                listenersMap[queueName] = {};
            }
            console.log("AddItemListener " + listenerId + " on map " + queueName);
            listenersMap[queueName][listenerId] = listener;
        });
}

function removeItemListener(queueName, listenerId) {
    return getMap(queueName).removeEntryListener(listenerId)
        .then(function() {
            delete listenersMap[queueName][listenerId];
        });
}

function addReconnectionListener(id, listener) {
    if (!reconnectionListenersMap[id]) {
        reconnectionListenersMap[id] = [];
    }
    console.log("Added listener with id " + id);
    reconnectionListenersMap[id].push(listener);
}

function removeReconnectionListeners(id) {
    console.log("Deleted listener with id " + id);
    delete reconnectionListenersMap[id];
}

function notifyReconnectionListeners(type) {
    for (var id in reconnectionListenersMap) {
        if (reconnectionListenersMap.hasOwnProperty(id)) {
            console.log("Notify listener of id " + id);
            reconnectionListenersMap[id].forEach(function(listener) {
                if (typeof listener === "function") {
                    listener(type);
                }
            });
        }
    }
}