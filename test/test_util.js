const net = require('net');
const { spawn } = require('child_process');
var server = null;
var hazelcastServer = null;

function startUnresponsiveServer(port) {
    server = net.createServer(function (socket) {
        //no-response
    });
    server.listen(port);
}

function stopUnresponsiveServer() {
    if (server)
        server.close();
    server = null;
}

function startHazelcastMember() {
    hazelcastServer = spawn('startCluster.bat');
    hazelcastServer.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    hazelcastServer.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
    });

    hazelcastServer.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}

function stopHazelcastMember() {
    if (hazelcastServer)
        hazelcastServer.kill();
    hazelcastServer = null;
}

module.exports = {
    startUnresponsiveServer:startUnresponsiveServer,
    stopUnresponsiveServer:stopUnresponsiveServer,
    startHazelcastMember: startHazelcastMember,
    stopHazelcastMember: stopHazelcastMember
};