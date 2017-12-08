"use strict";

const async = require("async");
const { SinkTask } = require("kafka-connect");

class YildizSinkTask extends SinkTask {

    start(properties, callback, parentConfig) {

        this.parentConfig = parentConfig;
        this.properties = properties;
        const {
            yildizClient,
            maxTasks,
            batchSize
        } = this.properties;

        this.yildizClient = yildizClient;
        this.batchSize = batchSize;
        this.maxTasks = maxTasks;

        this.buffer = [];
        this.bufferDraining = false;

        this._stats = {
            nodesCreated: 0,
            transalationsCreated: 0,
            nodesFound: 0,
            edgesCreated: 0,
            edgeDepthsIncreased: 0
        };

        this.parentConfig.on("get-stats", () => {
            this.parentConfig.emit("any-stats", "yildiz-sink", this._stats);
        });

        callback();
    }

    async saveNodes(nodes) {
        return new Promise((resolve, reject) =>
            async.reduce(
                nodes,
                new Map(),
                (nodesMap, node, next) => {
                    const {
                        plainIdentifier,
                        data = {},
                        translationData = {},
                        ttld = false
                    } = node;

                    this.yildizClient.getNode(plainIdentifier)
                        .then(yildizNode => {
                            if (yildizNode) {
                                nodesMap.set(plainIdentifier, yildizNode);
                                this._stats.nodesFound++;
                                return next(null, nodesMap);
                            }
                            //store the translation for human read-able access
                            return this.yildizClient.storeTranslation(
                                plainIdentifier,
                                translationData,
                                ttld
                            )
                                .then(() => {
                                    this._stats.transalationsCreated++;
                                    return this.yildizClient.createNode(
                                        plainIdentifier,
                                        data,
                                        ttld
                                    );
                                })
                                .then(yildizNode => {
                                    nodesMap.set(plainIdentifier, yildizNode);
                                    this.parentConfig.emit("model-upsert");
                                    this._stats.nodesCreated++;
                                    next(null, nodesMap);
                                });
                        })
                        .catch(error => next(error));
                },
                (error, nodesMap) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(nodesMap);
                }
            ));
    }

    async saveEdges(edges, nodesMap) {
        return new Promise((resolve, reject) =>
            async.eachSeries(
                edges,
                (edge, next) => {
                    const {
                        leftPlainIdentifier,
                        rightPlainIdentifier,
                        relation,
                        attributes = {},
                        ttld = false,
                        increaseDepth = false
                    } = edge;

                    const leftNode = nodesMap.get(leftPlainIdentifier);
                    const rightNode = nodesMap.get(rightPlainIdentifier);
                    const leftNodeId = leftNode.id;
                    const rightNodeId = rightNode.id;

                    this.yildizClient.getEdge(leftNodeId, rightNodeId, relation)
                        .then(edge => {
                            if (!edge || (edge && !increaseDepth)) {
                                this._stats.edgesCreated++;
                                this.parentConfig.emit("model-upsert");
                                return this.yildizClient.createEdge(
                                    leftNodeId,
                                    rightNodeId,
                                    relation,
                                    attributes,
                                    ttld
                                );
                            } else {
                                this._stats.edgeDepthsIncreased++;
                                this.parentConfig.emit("model-upsert");
                                return this.yildizClient.increaseEdgeDepth(
                                    leftNodeId,
                                    rightNodeId,
                                    relation
                                );
                            }
                        })
                        .then(() => next())
                        .catch(error => next(error))
                },
                error => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                }
            ));
    }

    /**
     * awaits a records object with the following structure
     * {
     *     nodes: [
     *         {
     *             plainIdentifier: string,
     *             data: object,
     *             translationData: object,
     *             ttls: boolean
     *         }
     *     ],
     *     edges: [
     *         {
     *             leftPlainIdentifier: string,
     *             rightPlainIdentifier: string,
     *             relation: string,
     *             attributes: object,
     *             ttls: boolean,
     *             increaseDepth: boolean
     *         }
     *     ]
     * }
     */
    async putRecords(records) {
        return new Promise((resolve, reject) => {
            async.eachSeries(
                records,
                (record, next) => {
                    if (!record.value) {
                        return next();
                    }
                    this.saveNodes(record.value.nodes)
                        .then(nodesMap => this.saveEdges(record.value.edges, nodesMap))
                        .then(() => next())
                        .catch(error => next(error));
                },
                error => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                }
            )
        });
    }

    put(records, callback) {
        this.putRecords(records)
            .then(() => callback(null))
            .catch(error => callback(error));
    }

    stop() {
        //empty
    }
}

module.exports = YildizSinkTask;