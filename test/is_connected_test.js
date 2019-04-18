var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var hazelcast = require('../index');
var util = require('./test_util');

describe('test method is connected', function() {

    var unresponsivePort = 5702;

    before(function () {
        util.startUnresponsiveServer(unresponsivePort);
        util.startHazelcastMember();
    });

    after(function() {
        util.stopUnresponsiveServer();
        util.stopHazelcastMember();
        //To make the test stops in webstorm
        setTimeout(function() {
            process.exit(0);
        },1000);
    });

    it ('should fail to connect', function() {
        this.timeout(0);

        var cfg = {
            "network": {
                "clusterMembers": [
                    "127.0.0.1:"+unresponsivePort
                ],
                "connectionTimeout": 2000,
                "connectionAttemptPeriod": 1000,
                "connectionAttemptLimit": 1
            }
        };
        return expect(hazelcast.getOrCreateClient(cfg)).to.eventually.be.rejected;
    });

    it ('should connect', function() {
        this.timeout(0);

        var cfg = {
            "network": {
                "clusterMembers": [
                    "127.0.0.1:5701"
                ],
                "connectionTimeout": 5000,
                "connectionAttemptPeriod": 3000,
                "connectionAttemptLimit": 2
            }
        };
        return expect(hazelcast.getOrCreateClient(cfg)).to.eventually.be.fulfilled;
    });

    it ('should connect and check connection status', function() {
        this.timeout(0);

        var cfg = {
            "network": {
                "clusterMembers": [
                    "127.0.0.1:5701"
                ],
                "connectionTimeout": 5000,
                "connectionAttemptPeriod": 3000,
                "connectionAttemptLimit": 2
            }
        };
        return expect(hazelcast.getOrCreateClient(cfg)).to.eventually.be.fulfilled
            .then((client) => {
                return expect(client.isConnected()).to.eventually.be.fulfilled;
            });
    });

});

