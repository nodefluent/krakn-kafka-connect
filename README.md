# yildiz-kafka-connect

[![Greenkeeper badge](https://badges.greenkeeper.io/nodefluent/yildiz-kafka-connect.svg)](https://greenkeeper.io/)
Kafka Connect connector for yildiz db

[![Build Status](https://travis-ci.org/nodefluent/yildiz-kafka-connect.svg?branch=master)](https://travis-ci.org/nodefluent/yildiz-kafka-connect)

[![Coverage Status](https://coveralls.io/repos/github/nodefluent/yildiz-kafka-connect/badge.svg?branch=master)](https://coveralls.io/github/nodefluent/yildiz-kafka-connect?branch=master)

## Use API

```
npm install --save yildiz-kafka-connect
```

### yildiz -> kafka

```es6
const { runSourceConnector } = require("yildiz-kafka-connect");
runSourceConnector(config, [], onError).then(config => {
    //runs forever until: config.stop();
});
```

### kafka -> yildiz

```es6
const { runSinkConnector } = require("yildiz-kafka-connect");
runSinkConnector(config, [], onError).then(config => {
    //runs forever until: config.stop();
});
```

### kafka -> yildiz (with custom topic (no source-task topic))

```es6
const { runSinkConnector, ConverterFactory } = require("yildiz-kafka-connect");

const etlFunc = (messageValue, callback) => {

    return callback(null, {
        id: messageValue.payload.id,
        name: messageValue.payload.name,
        info: messageValue.payload.info
    });
};

const converter = ConverterFactory.createSinkSchemaConverter({}, etlFunc);

runSinkConnector(config, [converter], onError).then(config => {
    //runs forever until: config.stop();
});

/*
    this example would be able to store kafka message values
    that look like this (so completely unrelated to messages created by a default SourceTask)
    {
        payload: {
            id: 1,
            name: "first item",
            info: "some info"
        },
        type: "publish"
    }
*/
```

## Use CLI
note: in BETA :seedling:

```
npm install -g yildiz-kafka-connect
```

```
# run source etl: yildiz -> kafka
nkc-yildiz-source --help
```

```
# run sink etl: kafka -> yildiz
nkc-yildiz-sink --help
```

## Config(uration)
```es6
const config = {
    kafka: {
        zkConStr: "localhost:2181/",
        logger: null,
        groupId: "kc-yildiz-test",
        clientName: "kc-yildiz-test-name",
        workerPerPartition: 1,
        options: {
            sessionTimeout: 8000,
            protocol: ["roundrobin"],
            fromOffset: "earliest", //latest
            fetchMaxBytes: 1024 * 100,
            fetchMinBytes: 1,
            fetchMaxWaitMs: 10,
            heartbeatInterval: 250,
            retryMinTimeout: 250,
            requireAcks: 1,
            //ackTimeoutMs: 100,
            //partitionerType: 3
        }
    },
    topic: "yildiz-test-topic",
    partitions: 1,
    maxTasks: 1,
    pollInterval: 2000,
    produceKeyed: true,
    produceCompressionType: 0,
    connector: {
        batchSize: 500,
        maxPollCount: 500
    },
    http: {
        port: 3149,
        middlewares: []
    },
    enableMetrics: true
};
```
