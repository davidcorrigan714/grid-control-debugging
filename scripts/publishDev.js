var exec = require("child_process").exec;

var manifest = require("../vss-extension.json");
var extensionId = manifest.id;
var extensionPublisher = manifest.publisher;
var extensionVersion = manifest.version;

// Package extension
var command = `tfx extension publish --vsix ${extensionPublisher}.${extensionId}-dev-${extensionVersion}.vsix --no-prompt --share-with davidcorrigan --token 6rzchiwy45b7qp5vtfbxnbajdjnu2uyaypcfww7p56wm6e6djhka`;
exec(command, function() {
    console.log("Package published.");
});