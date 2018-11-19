# hazelcast-wrapper
Wrapper for the hazelcast library.

```bash
npm install @alucarpd86/dotenv-json
```

Why?

- automatic reconnection
- automatic re-initialization of listeners

How to initialize the wrapper:

```js
var hazelcast = require("hazelcast-wrapper");

var conf = {
    "name": "My_Group",
    "password": "My_Group_Secret",
    "addresses": [
        {
            "host": "127.0.0.1",
            "port": "4401"
        }
    ],
    "smartRouting": true,
    "heartbeatInterval": 5000,
    "heartbeatTimeout": 60000
};

hazelcast.forge(conf)
    .then((result) => {
        console.log("Connected!");
        ...
    })
    .catch((err) => {
        console.log("Hazelcast cluste not reachable!");
    });
```