var exec = require("child_process").exec;

var manifest = require("../vss-extension.json");
var extensionId = manifest.id;
var extensionPublisher = manifest.publisher;
var extensionVersion = manifest.version;

// Package extension
var command = `tfx extension publish --vsix ${extensionPublisher}.${extensionId}-dev-${extensionVersion}.vsix --no-prompt --share-with davidcorrigan nitest davidcorrigan0258 --token ` + process.env.AZDO_PUBLISHER_PAT;
exec(command, function() {
    console.log("Package published.");
});