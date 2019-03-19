var exec = require("child_process").exec;

var manifest = require("../vss-extension.json");
var extensionId = manifest.id;
var extensionPublisher = manifest.publisher;
var extensionVersion = manifest.version;

// Package extension
var command = `tfx extension publish --vsix ${extensionPublisher}.${extensionId}-dev-${extensionVersion}.vsix --no-prompt --share-with davidcorrigan nitest --token cp5my7f7dqya4t2mwoge34iudlax7dllpyx6mvgsrwrwqq7mre2q`;
exec(command, function() {
    console.log("Package published.");
});