const path = require("path");
const CircularDependencyPlugin = require("circular-dependency-plugin");
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
module.exports = {
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, "./dist"),
  publicPath: "/minecraft/",
  configureWebpack: {
    plugins: [
      new CircularDependencyPlugin()
      // new BundleAnalyzerPlugin()
    ]
  },
  chainWebpack: config => {
    config.plugin("html").tap(args => {
      args[0].title = "everything the light touches";
      return args;
    });
  }
};
