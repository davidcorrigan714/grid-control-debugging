var path = require("path");
var webpack = require("webpack");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    target: "web",
    entry: {
        multivalue: "./src/multivalue.ts",
        productsservice: "./src/productsservice.ts",
        formselectordialog: "./src/formselectordialog.ts",
        productshub: "./src/productshub.ts",
        productshubareas: "./src/productshubareas.ts"
    },
    output: {
        filename: "src/[name].js",
        libraryTarget: "amd"
    },
    externals: [
        {
        },
        /^VSS\/.*/, /^TFS\/.*/, /^q$/
    ],
    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
        moduleExtensions: ["-loader"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader"
            },
            {
                test: /\.s?css$/,
                use: ["style-loader", "css-loader", "sass-loader"]
            }
        ]
    },
    mode: "development",
    plugins: [
        new BundleAnalyzerPlugin({
          openAnalyzer: false,
          reportFilename: "bundle-analysis.html",
          analyzerMode: "static"
        }),
        new CopyWebpackPlugin([
            { from: "./node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js", to: "libs/VSS.SDK.min.js" },
            { from: "./node_modules/bootstrap/dist/js/bootstrap.min.js", to: "./js" },
            { from: "./node_modules/bootstrap-datepicker/dist/js/bootstrap-datepicker.min.js", to: "./js" },
            { from: "./node_modules/bootstrap-datepicker/dist/css/bootstrap-datepicker.min.css", to: "./css" },
            { from: "./node_modules/bootstrap/dist/css/bootstrap.min.css", to: "./css" },
            { from: "./node_modules/jquery-ui-bundle/jquery-ui.min.css", to: "./css"},
            { from: "./node_modules/jquery/dist/jquery.min.js", to: "./js" },
            { from: "./node_modules/jquery-ui-bundle/jquery-ui.min.js", to: "./js"},
            { from: "./node_modules/lunr/lunr.min.js", to: "./js"},
            { from: "./src/productselector.html", to: "./" },
            { from: "./src/formselectordialog.html", to: "./" },
            { from: "./src/productshub.html", to: "./" },
            { from: "./src/productsservice.html", to: "./"},
            { from: "./src/products.css", to: "./css"}
        ])
    ]
}