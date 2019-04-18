module.exports = Object.assign(
    {},
    require('hazelcast-client'),
    require('./lib/connection')
);